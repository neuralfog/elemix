//! Parse the HTML inside a ``tpl`` `` template (holes swapped for opaque markers)
//! into a small tree, then translate that tree to the Doc IR. Fault-tolerant: a
//! template it can't make sense of returns `None` and is left untouched by the
//! caller. Standalone - the printing rules are ported from prettier (the oracle),
//! sitting on the generic Doc engine in `doc.rs`.

use crate::doc::{
    self, concat, fill, group, hardline, indent, line, literalline, nil, softline, text, Doc,
    Options,
};

// Holes become a private-use marker `\u{fffc}<n>\u{fffc}` so the HTML parser sees
// them as opaque atoms; the real `${expr}` is restored when building the Doc, so
// widths stay honest.
const MARK: char = '\u{fffc}';

fn marker(i: usize) -> String {
    format!("{MARK}{i}{MARK}")
}

/// HTML void elements - never have children or a closing tag.
const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

/// Raw-text / pre-like elements - content is verbatim, never reflowed.
const RAW: &[&str] = &["pre", "textarea", "script", "style"];

/// Block-display tags. Their leading/trailing whitespace collapses, so their
/// content can be broken/reindented freely. Everything else (spans, buttons, and
/// custom `<x-y>` tags) defaults to inline, where content is space-sensitive.
const BLOCK: &[&str] = &[
    "html",
    "head",
    "body",
    "div",
    "p",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "main",
    "aside",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "form",
    "fieldset",
    "legend",
    "figure",
    "figcaption",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "select",
    "option",
    "svg",
    "g",
];

fn is_void(tag: &str) -> bool {
    VOID.contains(&tag)
}
fn is_raw(tag: &str) -> bool {
    RAW.contains(&tag)
}
fn is_block(tag: &str) -> bool {
    BLOCK.contains(&tag)
}

/// A custom element (`<todo-app>`, `<icon-sun>`) - any tag with a hyphen. Treated
/// as block for layout: an elemix component sits on its own line.
fn is_custom(tag: &str) -> bool {
    tag.contains('-')
}

#[derive(Debug)]
enum Node {
    Element(Element),
    Text(String),
    Comment(String),
    Doctype(String),
}

#[derive(Debug)]
struct Element {
    tag: String,
    attrs: Vec<Attr>,
    children: Vec<Node>,
    self_closed: bool,
}

#[derive(Debug)]
struct Attr {
    name: String,
    /// `Some((quote, value))` - quote is `"`/`'`/`\0` (unquoted); `None` is a
    /// bare boolean attribute.
    value: Option<(char, String)>,
}

// -- public entry -----------------------------------------------------------

/// Format one template's inner HTML. `statics`/`holes` come from the scanner.
/// Returns the formatted HTML (starting at column 0), or `None` to bail (the
/// caller then leaves the original template untouched).
pub fn format_template(
    statics: &[String],
    holes: &[String],
    opts: &Options,
    base_indent: usize,
) -> Option<String> {
    // A hole may itself hold nested tpl`` (e.g. a `repeat` render). Run the
    // formatter over each hole's code so nested templates - at any depth - are
    // formatted too; the non-template JS around them is left byte-for-byte.
    let holes: Vec<String> = holes
        .iter()
        .map(|h| crate::format::format_source(h, opts).output)
        .collect();
    let holes = &holes[..];

    let mut input = String::new();
    for (i, chunk) in statics.iter().enumerate() {
        input.push_str(chunk);
        if i < holes.len() {
            input.push_str(&marker(i));
        }
    }

    let nodes = parse(&input)?;
    let doc = roots_to_doc(&nodes, holes);
    Some(doc::print_at(doc, opts, base_indent))
}

// -- parser -----------------------------------------------------------------

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
    src: &'a str,
    last_was_self_close: bool,
}

fn parse(input: &str) -> Option<Vec<Node>> {
    let mut p = Parser {
        b: input.as_bytes(),
        i: 0,
        src: input,
        last_was_self_close: false,
    };
    let (nodes, _closed) = p.parse_nodes(None);
    Some(nodes)
}

impl Parser<'_> {
    fn slice(&self, a: usize, z: usize) -> String {
        self.src[a..z].to_string()
    }

    /// Parse a run of sibling nodes until EOF or the close tag `</parent>`.
    /// Returns the nodes and whether it stopped on its own close tag.
    fn parse_nodes(&mut self, parent: Option<&str>) -> (Vec<Node>, bool) {
        let mut nodes = Vec::new();
        while self.i < self.b.len() {
            if self.b[self.i] == b'<' {
                // A closing tag for our parent?
                if self.starts_with("</") {
                    let save = self.i;
                    if let Some(name) = self.try_close_tag() {
                        if parent.map(|p| p.eq_ignore_ascii_case(&name)) == Some(true) {
                            return (nodes, true);
                        }
                        // A stray/mismatched close tag: drop it and continue.
                        continue;
                    }
                    self.i = save;
                }
                if self.starts_with("<!--") {
                    nodes.push(self.parse_comment());
                    continue;
                }
                if self.starts_with("<!") {
                    nodes.push(self.parse_doctype());
                    continue;
                }
                if self.at_tag_start() {
                    if let Some(node) = self.parse_element() {
                        nodes.push(node);
                        continue;
                    }
                }
                // A lone `<` that isn't a tag: treat as text.
                let start = self.i;
                self.i += 1;
                nodes.push(Node::Text(self.slice(start, self.i)));
                continue;
            }
            // Text run up to the next `<`.
            let start = self.i;
            while self.i < self.b.len() && self.b[self.i] != b'<' {
                self.i += 1;
            }
            nodes.push(Node::Text(self.slice(start, self.i)));
        }
        (nodes, false)
    }

    fn starts_with(&self, s: &str) -> bool {
        self.src[self.i..].starts_with(s)
    }

    fn at_tag_start(&self) -> bool {
        self.i + 1 < self.b.len()
            && self.b[self.i] == b'<'
            && (self.b[self.i + 1].is_ascii_alphabetic())
    }

    fn parse_comment(&mut self) -> Node {
        let start = self.i + 4;
        while self.i < self.b.len() && !self.src[self.i..].starts_with("-->") {
            self.i += 1;
        }
        let inner = self.slice(start, self.i);
        self.i = (self.i + 3).min(self.b.len());
        Node::Comment(inner.trim().to_string())
    }

    fn parse_doctype(&mut self) -> Node {
        let start = self.i;
        while self.i < self.b.len() && self.b[self.i] != b'>' {
            self.i += 1;
        }
        self.i = (self.i + 1).min(self.b.len());
        Node::Doctype(self.slice(start, self.i))
    }

    fn try_close_tag(&mut self) -> Option<String> {
        // self.i at `<`, we've checked "</".
        let mut j = self.i + 2;
        let name_start = j;
        while j < self.b.len() && (self.b[j].is_ascii_alphanumeric() || matches!(self.b[j], b'-')) {
            j += 1;
        }
        let name = self.src[name_start..j].to_string();
        while j < self.b.len() && self.b[j] != b'>' {
            j += 1;
        }
        if j >= self.b.len() {
            return None;
        }
        self.i = j + 1;
        Some(name)
    }

    fn parse_element(&mut self) -> Option<Node> {
        let mut j = self.i + 1;
        let name_start = j;
        while j < self.b.len()
            && (self.b[j].is_ascii_alphanumeric() || matches!(self.b[j], b'-' | b':'))
        {
            j += 1;
        }
        let tag = self.src[name_start..j].to_string();
        if tag.is_empty() {
            return None;
        }
        self.i = j;

        let attrs = self.parse_attrs();
        // self.i now at `>` or `/>` end (parse_attrs consumes to just past `>`).
        let self_closed = self.last_was_self_close;

        if is_void(&tag) || self_closed {
            return Some(Node::Element(Element {
                tag,
                attrs,
                children: Vec::new(),
                self_closed,
            }));
        }

        let children = if is_raw(&tag) {
            self.parse_raw_text(&tag)
        } else {
            let (kids, _) = self.parse_nodes(Some(&tag));
            kids
        };

        Some(Node::Element(Element {
            tag,
            attrs,
            children,
            self_closed: false,
        }))
    }

    fn parse_raw_text(&mut self, tag: &str) -> Vec<Node> {
        let start = self.i;
        let close = format!("</{tag}");
        while self.i < self.b.len() && !self.src[self.i..].to_ascii_lowercase().starts_with(&close)
        {
            self.i += 1;
        }
        let text = self.slice(start, self.i);
        // consume the close tag
        while self.i < self.b.len() && self.b[self.i] != b'>' {
            self.i += 1;
        }
        self.i = (self.i + 1).min(self.b.len());
        if text.is_empty() {
            Vec::new()
        } else {
            vec![Node::Text(text)]
        }
    }

    fn skip_ws(&mut self) {
        while self.i < self.b.len() && self.b[self.i].is_ascii_whitespace() {
            self.i += 1;
        }
    }

    fn parse_attrs(&mut self) -> Vec<Attr> {
        let mut attrs = Vec::new();
        self.last_was_self_close = false;
        loop {
            self.skip_ws();
            if self.i >= self.b.len() {
                break;
            }
            match self.b[self.i] {
                b'>' => {
                    self.i += 1;
                    break;
                }
                b'/' if self.i + 1 < self.b.len() && self.b[self.i + 1] == b'>' => {
                    self.last_was_self_close = true;
                    self.i += 2;
                    break;
                }
                _ => {
                    if let Some(a) = self.parse_attr() {
                        attrs.push(a);
                    } else {
                        // couldn't advance - consume one byte to avoid a loop.
                        self.i += 1;
                    }
                }
            }
        }
        attrs
    }

    fn parse_attr(&mut self) -> Option<Attr> {
        let start = self.i;
        while self.i < self.b.len()
            && !matches!(self.b[self.i], b'=' | b'>' | b'/')
            && !self.b[self.i].is_ascii_whitespace()
        {
            self.i += 1;
        }
        if self.i == start {
            return None;
        }
        let name = self.slice(start, self.i);
        self.skip_ws();
        if self.i < self.b.len() && self.b[self.i] == b'=' {
            self.i += 1;
            self.skip_ws();
            let value = self.parse_attr_value();
            Some(Attr {
                name,
                value: Some(value),
            })
        } else {
            Some(Attr { name, value: None })
        }
    }

    fn parse_attr_value(&mut self) -> (char, String) {
        if self.i < self.b.len() && matches!(self.b[self.i], b'"' | b'\'') {
            let quote = self.b[self.i] as char;
            self.i += 1;
            let start = self.i;
            while self.i < self.b.len() && self.b[self.i] as char != quote {
                self.i += 1;
            }
            let v = self.slice(start, self.i);
            self.i = (self.i + 1).min(self.b.len());
            (quote, v)
        } else {
            let start = self.i;
            while self.i < self.b.len()
                && !self.b[self.i].is_ascii_whitespace()
                && !matches!(self.b[self.i], b'>' | b'/')
            {
                self.i += 1;
            }
            ('\0', self.slice(start, self.i))
        }
    }
}

// -- tree -> Doc ------------------------------------------------------------

/// Replace hole markers in `s` with the real `${expr}` text.
fn restore(s: &str, holes: &[String]) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == MARK {
            let mut num = String::new();
            for d in chars.by_ref() {
                if d == MARK {
                    break;
                }
                num.push(d);
            }
            if let Ok(idx) = num.parse::<usize>() {
                if let Some(h) = holes.get(idx) {
                    out.push_str("${");
                    out.push_str(h);
                    out.push('}');
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Render a hole as a Doc. A single-line hole is one atom; a multi-line hole is
/// dedented (its continuation lines rebased to relative-zero) and rejoined with
/// hardlines, so the printer re-indents it to the new context while its internal
/// relative structure - and its bytes - are preserved. Its hardlines also force
/// the containing tag/element to break (spec).
fn hole_doc(hole: &str) -> Doc {
    if !hole.contains('\n') {
        return text(format!("${{{hole}}}"));
    }
    let lines: Vec<&str> = hole.split('\n').collect();
    let last = lines.len() - 1;
    let indent_of = |l: &str| l.len() - l.trim_start().len();
    // Dedent base: when the hole's closing line is on its own (whitespace only),
    // its indent is where `${`/`}` align, so use it. Otherwise fall back to the
    // shallowest continuation line. This keeps the content's relative structure.
    let min_indent = if lines[last].trim().is_empty() {
        indent_of(lines[last])
    } else {
        lines[1..]
            .iter()
            .filter(|l| !l.trim().is_empty())
            .map(|l| indent_of(l))
            .min()
            .unwrap_or(0)
    };
    let mut parts = vec![text(format!("${{{}", lines[0]))];
    for (i, l) in lines.iter().enumerate().skip(1) {
        parts.push(hardline());
        let stripped = if l.len() >= min_indent {
            &l[min_indent..]
        } else {
            l.trim_start()
        };
        if i == last {
            parts.push(text(format!("{stripped}}}")));
        } else {
            parts.push(text(stripped.to_string()));
        }
    }
    concat(parts)
}

/// Emit text exactly as-is, its newlines becoming `literalline` (a break with no
/// re-indent) - for raw/pre-like content that must stay byte-for-byte.
fn verbatim_doc(raw: &str) -> Doc {
    let lines: Vec<&str> = raw.split('\n').collect();
    let mut parts = vec![text(lines[0].to_string())];
    for l in &lines[1..] {
        parts.push(literalline());
        parts.push(text(l.to_string()));
    }
    concat(parts)
}

/// If `tok` is exactly one hole marker, return its verbatim (multi-line-aware)
/// Doc; otherwise `None`. Keeps a hole atomic even when it wraps a `?:`/lambda.
fn as_single_hole(tok: &str, holes: &[String]) -> Option<Doc> {
    let mut chars = tok.chars();
    if chars.next() != Some(MARK) {
        return None;
    }
    let mut num = String::new();
    for c in chars.by_ref() {
        if c == MARK {
            break;
        }
        if !c.is_ascii_digit() {
            return None;
        }
        num.push(c);
    }
    if chars.next().is_some() {
        return None; // trailing chars after the marker
    }
    let idx: usize = num.parse().ok()?;
    Some(hole_doc(holes.get(idx)?))
}

fn roots_to_doc(nodes: &[Node], holes: &[String]) -> Doc {
    let kids = children_docs(nodes, holes);
    if kids.is_empty() {
        return nil();
    }
    // A template body is a block context: one root per line, blank lines removed.
    let mut parts = Vec::new();
    for (i, kid) in kids.into_iter().enumerate() {
        if i > 0 {
            parts.push(hardline());
        }
        parts.push(kid);
    }
    concat(parts)
}

/// Is a text node only whitespace (or empty)?
fn blank_text(n: &Node) -> bool {
    matches!(n, Node::Text(t) if t.trim().is_empty())
}

/// Build the Doc list for a node's children, dropping all structural whitespace
/// (including blank lines between siblings).
fn children_docs(nodes: &[Node], holes: &[String]) -> Vec<Doc> {
    let mut out: Vec<Doc> = Vec::new();
    for n in nodes {
        if blank_text(n) {
            continue;
        }
        let doc = match n {
            Node::Text(t) => text_doc(t, holes),
            Node::Comment(c) => text(format!("<!-- {} -->", restore(c, holes))),
            Node::Doctype(d) => text(restore(d, holes)),
            Node::Element(e) => element_doc(e, holes),
        };
        out.push(doc);
    }
    out
}

/// Collapse whitespace in a text run and reflow its words with `fill`. Crucially,
/// we tokenise the MARKER text first (a hole is a single spaceless marker token)
/// and only then restore each token - so a hole is always ONE atom and is never
/// word-split, whatever `${expr}` it holds (hole-preservation is a hard guarantee).
fn text_doc(t: &str, holes: &[String]) -> Doc {
    let tokens: Vec<&str> = t.split_whitespace().collect();
    if tokens.is_empty() {
        return nil();
    }
    let atom = |tok: &str| as_single_hole(tok, holes).unwrap_or_else(|| text(restore(tok, holes)));
    if tokens.len() == 1 {
        return atom(tokens[0]);
    }
    let mut parts = Vec::new();
    for (i, tok) in tokens.iter().enumerate() {
        if i > 0 {
            parts.push(line());
        }
        parts.push(atom(tok));
    }
    fill(parts)
}

fn element_doc(e: &Element, holes: &[String]) -> Doc {
    let open = open_tag_doc(e, holes);

    if e.self_closed || is_void(&e.tag) {
        return open;
    }

    let close = text(format!("</{}>", e.tag));

    // Raw-text / pre-like (`pre`, `textarea`, ...): content is whitespace
    // sensitive, emitted verbatim - never collapsed, reflowed, or re-indented.
    if is_raw(&e.tag) {
        let raw: String = e
            .children
            .iter()
            .filter_map(|n| match n {
                Node::Text(t) => Some(restore(t, holes)),
                _ => None,
            })
            .collect();
        if raw.is_empty() {
            return concat(vec![open, close]);
        }
        return concat(vec![open, verbatim_doc(&raw), close]);
    }

    // No meaningful children -> `<tag></tag>`.
    let kids = children_docs(&e.children, holes);
    if kids.is_empty() {
        return concat(vec![open, close]);
    }

    // Block layout when the element wraps structure rather than prose: a block or
    // custom child, a comment, or ELEMENT-ONLY content (e.g. a `<div>` around a
    // `<span>` - the child goes on its own line). Text mixed with inline elements
    // (`<code>`, `<b>`, holes) is prose and stays in the inline flow (one `fill`).
    let has_element = e.children.iter().any(|n| matches!(n, Node::Element(_)));
    let has_text = e
        .children
        .iter()
        .any(|n| matches!(n, Node::Text(t) if !t.trim().is_empty()));
    let force_block = e.children.iter().any(|n| match n {
        Node::Element(c) => is_block(&c.tag) || is_custom(&c.tag),
        Node::Comment(_) => true,
        _ => false,
    }) || (has_element && !has_text);

    if force_block {
        let mut inner = Vec::new();
        for kid in kids {
            inner.push(hardline());
            inner.push(kid);
        }
        return group(concat(vec![open, indent(concat(inner)), hardline(), close]));
    }

    // Inline flow (text + inline elements). If the content touches the tags (no
    // surrounding whitespace in the source) and the element is itself inline, it
    // is space-sensitive: a line break there would change the rendered DOM, so
    // keep it flush. Block parents collapse boundary whitespace, so they may break.
    let content = inline_content(&e.children, holes);
    let sensitive = !is_block(&e.tag) && edge_sensitive(&e.children);

    if sensitive {
        concat(vec![open, content, close])
    } else {
        group(concat(vec![
            open,
            indent(concat(vec![softline(), content])),
            softline(),
            close,
        ]))
    }
}

/// True when the content touches both tags (no whitespace at either edge) - so
/// inserting a break there would change what the browser renders.
fn edge_sensitive(children: &[Node]) -> bool {
    let leading = match children.first() {
        Some(Node::Text(t)) => !t.starts_with(char::is_whitespace),
        Some(Node::Element(_)) => true,
        _ => false,
    };
    let trailing = match children.last() {
        Some(Node::Text(t)) => !t.ends_with(char::is_whitespace),
        Some(Node::Element(_)) => true,
        _ => false,
    };
    leading && trailing
}

/// Reflow a run of text + inline elements as one `fill`. Atoms that TOUCH in the
/// source (no whitespace between them, e.g. `(<code>x</code>)`) are merged into a
/// single unbreakable unit, so a break can never be inserted mid-unit (that would
/// change the render); the only wrap points are the `line`s where the source had
/// whitespace. That also lets `fill` move a whole unit to the next line.
fn inline_content(children: &[Node], holes: &[String]) -> Doc {
    let mut units: Vec<Doc> = Vec::new();
    let mut cur: Vec<Doc> = Vec::new();
    let mut pending_ws = false;

    let add = |atom: Doc, ws_before: bool, units: &mut Vec<Doc>, cur: &mut Vec<Doc>| {
        if ws_before && !cur.is_empty() {
            units.push(collapse(std::mem::take(cur)));
        }
        cur.push(atom);
    };

    for n in children {
        match n {
            Node::Text(t) => {
                let leading = t.starts_with(char::is_whitespace);
                let trailing = t.ends_with(char::is_whitespace);
                let toks: Vec<&str> = t.split_whitespace().collect();
                for (wi, tok) in toks.iter().enumerate() {
                    let atom =
                        as_single_hole(tok, holes).unwrap_or_else(|| text(restore(tok, holes)));
                    let ws_before = if wi == 0 { pending_ws || leading } else { true };
                    add(atom, ws_before, &mut units, &mut cur);
                }
                pending_ws = if toks.is_empty() {
                    pending_ws || leading || trailing
                } else {
                    trailing
                };
            }
            Node::Element(e) => {
                add(element_doc(e, holes), pending_ws, &mut units, &mut cur);
                pending_ws = false;
            }
            Node::Comment(c) => {
                let atom = text(format!("<!-- {} -->", restore(c, holes)));
                add(atom, pending_ws, &mut units, &mut cur);
                pending_ws = false;
            }
            Node::Doctype(_) => {}
        }
    }
    if !cur.is_empty() {
        units.push(collapse(cur));
    }

    match units.len() {
        0 => nil(),
        1 => units.into_iter().next().unwrap(),
        _ => {
            let mut parts = Vec::new();
            for (i, u) in units.into_iter().enumerate() {
                if i > 0 {
                    parts.push(line());
                }
                parts.push(u);
            }
            fill(parts)
        }
    }
}

/// One doc when the run has a single atom, else a concat (an unbreakable unit).
fn collapse(mut v: Vec<Doc>) -> Doc {
    if v.len() == 1 {
        v.pop().unwrap()
    } else {
        concat(v)
    }
}

fn open_tag_doc(e: &Element, holes: &[String]) -> Doc {
    let self_close = e.self_closed || is_void(&e.tag);

    if e.attrs.is_empty() {
        return if self_close {
            text(format!("<{} />", e.tag))
        } else {
            text(format!("<{}>", e.tag))
        };
    }

    let mut attr_lines = Vec::new();
    for a in &e.attrs {
        attr_lines.push(line());
        attr_lines.push(attr_doc(a, holes));
    }

    let bracket = if self_close {
        concat(vec![line(), text("/>")])
    } else {
        concat(vec![softline(), text(">")])
    };

    group(concat(vec![
        text(format!("<{}", e.tag)),
        indent(concat(attr_lines)),
        bracket,
    ]))
}

fn attr_doc(a: &Attr, holes: &[String]) -> Doc {
    let name = restore(&a.name, holes);
    match &a.value {
        None => text(name),
        // Unquoted value - typically a hole (`@click=${x}`, `:prop=${x}`). Keep it
        // atomic and multi-line-aware (e.g. an inline arrow handler).
        Some(('\0', val)) => match as_single_hole(val, holes) {
            Some(hd) => concat(vec![text(format!("{name}=")), hd]),
            None => text(format!("{name}={}", restore(val, holes))),
        },
        Some((quote, val)) => {
            let v = restore(val, holes);
            let rendered = if *quote == '\'' {
                format!("{name}='{v}'")
            } else {
                format!("{name}=\"{v}\"")
            };
            text(rendered)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fmt(statics: &[&str], holes: &[&str]) -> String {
        let s: Vec<String> = statics.iter().map(|x| x.to_string()).collect();
        let h: Vec<String> = holes.iter().map(|x| x.to_string()).collect();
        format_template(
            &s,
            &h,
            &Options {
                width: 80,
                tab_width: 4,
            },
            0,
        )
        .unwrap()
    }

    #[test]
    fn multi_root_template_one_per_line() {
        assert_eq!(
            fmt(&["<theme-switch /><todo-app />"], &[]),
            "<theme-switch />\n<todo-app />"
        );
    }

    #[test]
    fn void_elements_have_no_close() {
        assert_eq!(fmt(&["<hr>"], &[]), "<hr />");
        assert_eq!(fmt(&["<img src=\"a.png\">"], &[]), "<img src=\"a.png\" />");
        // A void element among siblings self-closes and doesn't swallow what
        // follows. Element-only content -> block layout, one per line.
        assert_eq!(
            fmt(&["<div><br><span>x</span></div>"], &[]),
            "<div>\n    <br />\n    <span>x</span>\n</div>"
        );
    }

    #[test]
    fn boolean_attributes_stay_bare() {
        assert_eq!(
            fmt(&["<input disabled type=\"text\" />"], &[]),
            "<input disabled type=\"text\" />"
        );
    }

    #[test]
    fn a_lone_hole_child_is_kept() {
        assert_eq!(fmt(&["", ""], &["this.body"]), "${this.body}");
    }

    #[test]
    fn a_hole_inside_a_quoted_attr_is_preserved() {
        assert_eq!(
            fmt(&["<div class=\"item ", "\"></div>"], &["on ? 'a' : 'b'"]),
            "<div class=\"item ${on ? 'a' : 'b'}\"></div>"
        );
    }

    #[test]
    fn pre_content_is_verbatim() {
        // Whitespace inside <pre> must not be collapsed or reflowed.
        let out = fmt(&["<pre>  a\n  b  </pre>"], &[]);
        assert!(out.contains("  a\n  b  "), "pre kept verbatim: {out:?}");
    }

    #[test]
    fn mixed_inline_content_stays_in_flow() {
        // Text with inline elements reflows as one run (fill), not one-per-line -
        // it fits, so it stays on a single line, render unchanged.
        assert_eq!(
            fmt(&["<p>hi <b>there</b> friend</p>"], &[]),
            "<p>hi <b>there</b> friend</p>"
        );
    }

    #[test]
    fn touching_inline_content_is_not_split() {
        // `(` touches `<code>` (no whitespace): a break would insert a space and
        // change the render, so they must stay together.
        let out = fmt(
            &["<p>see (<code>x.ts</code>) for the store and how it is wired up here</p>"],
            &[],
        );
        assert!(
            out.contains("(<code>x.ts</code>)"),
            "no space inserted: {out:?}"
        );
    }

    #[test]
    fn empty_and_blank_templates() {
        assert_eq!(fmt(&[""], &[]), "");
        assert_eq!(fmt(&["   \n  "], &[]), "");
    }

    #[test]
    fn keeps_a_short_element_inline() {
        assert_eq!(fmt(&["<div></div>"], &[]), "<div></div>");
        assert_eq!(fmt(&["<p>hi</p>"], &[]), "<p>hi</p>");
    }

    #[test]
    fn collapses_attribute_whitespace() {
        assert_eq!(
            fmt(&["<div   class=\"a\"    id=\"b\"></div>"], &[]),
            "<div class=\"a\" id=\"b\"></div>"
        );
    }

    #[test]
    fn preserves_a_hole_in_text_and_attrs() {
        assert_eq!(
            fmt(&["<span>", "</span>"], &["this.count"]),
            "<span>${this.count}</span>"
        );
        assert_eq!(
            fmt(&["<a href=", ">x</a>"], &["this.url"]),
            "<a href=${this.url}>x</a>"
        );
    }

    #[test]
    fn nests_element_children_one_per_line() {
        assert_eq!(
            fmt(&["<div><p>hi</p><p>yo</p></div>"], &[]),
            "<div>\n    <p>hi</p>\n    <p>yo</p>\n</div>"
        );
    }

    #[test]
    fn self_closes_and_pairs_correctly() {
        assert_eq!(fmt(&["<todo-app />"], &[]), "<todo-app />");
        assert_eq!(
            fmt(&["<todo-app></todo-app>"], &[]),
            "<todo-app></todo-app>"
        );
        assert_eq!(fmt(&["<br>"], &[]), "<br />");
    }

    #[test]
    fn breaks_attributes_when_they_overflow() {
        let out = fmt(
            &["<input type=\"text\" placeholder=\"what needs doing today friend\" class=\"the-input-field\" />"],
            &[],
        );
        assert!(out.starts_with("<input\n"), "attrs should break: {out}");
        assert!(out.trim_end().ends_with("/>"));
    }

    #[test]
    fn preserves_comments() {
        assert_eq!(
            fmt(&["<div><!-- hi --></div>"], &[]),
            "<div>\n    <!-- hi -->\n</div>"
        );
    }

    #[test]
    fn reflows_long_text_in_a_block() {
        let out = fmt(
            &["<p>one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen</p>"],
            &[],
        );
        assert!(out.starts_with("<p>\n"), "long text wraps: {out}");
    }
}
