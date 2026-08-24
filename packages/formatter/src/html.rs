use crate::doc::{
    self, concat, fill, group, hardline, indent, join, line, literalline, nil, softline, text, Doc,
    Options,
};

const MARK: char = '\u{fffc}';

fn marker(i: usize) -> String {
    format!("{MARK}{i}{MARK}")
}

const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

const RAW: &[&str] = &["pre", "textarea", "script", "style"];

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
    value: Option<(char, String)>,
}

pub fn format_template(
    statics: &[String],
    holes: &[String],
    opts: &Options,
    base_indent: usize,
) -> Option<String> {
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

    fn parse_nodes(&mut self, parent: Option<&str>) -> (Vec<Node>, bool) {
        let mut nodes = Vec::new();
        while self.i < self.b.len() {
            if self.b[self.i] == b'<' {
                if self.starts_with("</") {
                    let save = self.i;
                    if let Some(name) = self.try_close_tag() {
                        if parent.map(|p| p.eq_ignore_ascii_case(&name)) == Some(true) {
                            return (nodes, true);
                        }
                        nodes.push(Node::Text(self.slice(save, self.i)));
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
                let start = self.i;
                self.i += 1;
                nodes.push(Node::Text(self.slice(start, self.i)));
                continue;
            }
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
        while self.i < self.b.len()
            && !self
                .b
                .get(self.i..self.i + close.len())
                .is_some_and(|s| s.eq_ignore_ascii_case(close.as_bytes()))
        {
            self.i += 1;
        }
        let text = self.slice(start, self.i);
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

fn hole_doc(hole: &str) -> Doc {
    if !hole.contains('\n') {
        return text(format!("${{{hole}}}"));
    }
    let lines: Vec<&str> = hole.split('\n').collect();
    let last = lines.len() - 1;
    let indent_of = |l: &str| l.len() - l.trim_start().len();
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

fn verbatim_doc(raw: &str) -> Doc {
    let lines: Vec<&str> = raw.split('\n').collect();
    let mut parts = vec![text(lines[0].to_string())];
    for l in &lines[1..] {
        parts.push(literalline());
        parts.push(text(l.to_string()));
    }
    concat(parts)
}

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
        return None;
    }
    let idx: usize = num.parse().ok()?;
    Some(hole_doc(holes.get(idx)?))
}

fn roots_to_doc(nodes: &[Node], holes: &[String]) -> Doc {
    let kids = children_docs(nodes, holes);
    if kids.is_empty() {
        return nil();
    }
    join(hardline(), kids)
}

fn blank_text(n: &Node) -> bool {
    matches!(n, Node::Text(t) if t.trim().is_empty())
}

fn atom_doc(tok: &str, holes: &[String]) -> Doc {
    as_single_hole(tok, holes).unwrap_or_else(|| text(restore(tok, holes)))
}

fn comment_doc(c: &str, holes: &[String]) -> Doc {
    text(format!("<!-- {} -->", restore(c, holes)))
}

fn is_self_closing(e: &Element) -> bool {
    e.self_closed || is_void(&e.tag)
}

fn children_docs(nodes: &[Node], holes: &[String]) -> Vec<Doc> {
    let mut out: Vec<Doc> = Vec::new();
    for n in nodes {
        if blank_text(n) {
            continue;
        }
        let doc = match n {
            Node::Text(t) => text_doc(t, holes),
            Node::Comment(c) => comment_doc(c, holes),
            Node::Doctype(d) => text(restore(d, holes)),
            Node::Element(e) => element_doc(e, holes),
        };
        out.push(doc);
    }
    out
}

fn text_doc(t: &str, holes: &[String]) -> Doc {
    let atoms: Vec<Doc> = t
        .split_whitespace()
        .map(|tok| atom_doc(tok, holes))
        .collect();
    fill_lines(atoms)
}

fn fill_lines(items: Vec<Doc>) -> Doc {
    match items.len() {
        0 => nil(),
        1 => items.into_iter().next().unwrap(),
        _ => {
            let mut parts = Vec::new();
            for (i, item) in items.into_iter().enumerate() {
                if i > 0 {
                    parts.push(line());
                }
                parts.push(item);
            }
            fill(parts)
        }
    }
}

fn element_doc(e: &Element, holes: &[String]) -> Doc {
    let open = open_tag_doc(e, holes);

    if is_self_closing(e) {
        return open;
    }

    let close = text(format!("</{}>", e.tag));

    if is_raw(&e.tag) {
        return raw_element_doc(e, holes, open, close);
    }

    let kids = children_docs(&e.children, holes);
    if kids.is_empty() {
        return concat(vec![open, close]);
    }

    if force_block(&e.children) {
        return block_element_doc(open, kids, close);
    }

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

fn raw_element_doc(e: &Element, holes: &[String], open: Doc, close: Doc) -> Doc {
    let raw: String = e
        .children
        .iter()
        .filter_map(|n| match n {
            Node::Text(t) => Some(restore(t, holes)),
            _ => None,
        })
        .collect();
    if raw.is_empty() {
        concat(vec![open, close])
    } else {
        concat(vec![open, verbatim_doc(&raw), close])
    }
}

fn force_block(children: &[Node]) -> bool {
    let has_element = children.iter().any(|n| matches!(n, Node::Element(_)));
    let has_text = children
        .iter()
        .any(|n| matches!(n, Node::Text(t) if !t.trim().is_empty()));
    children.iter().any(|n| match n {
        Node::Element(c) => is_block(&c.tag) || is_custom(&c.tag),
        Node::Comment(_) => true,
        _ => false,
    }) || (has_element && !has_text)
}

fn block_element_doc(open: Doc, kids: Vec<Doc>, close: Doc) -> Doc {
    let mut inner = Vec::new();
    for kid in kids {
        inner.push(hardline());
        inner.push(kid);
    }
    group(concat(vec![open, indent(concat(inner)), hardline(), close]))
}

fn edge_sensitive(children: &[Node]) -> bool {
    let edge = |node: Option<&Node>, ws: fn(&str) -> bool| match node {
        Some(Node::Text(t)) => !ws(t),
        Some(Node::Element(_)) => true,
        _ => false,
    };
    edge(children.first(), |t| t.starts_with(char::is_whitespace))
        && edge(children.last(), |t| t.ends_with(char::is_whitespace))
}

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
                    let atom = atom_doc(tok, holes);
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
                let atom = comment_doc(c, holes);
                add(atom, pending_ws, &mut units, &mut cur);
                pending_ws = false;
            }
            Node::Doctype(_) => {}
        }
    }
    if !cur.is_empty() {
        units.push(collapse(cur));
    }

    fill_lines(units)
}

fn collapse(mut v: Vec<Doc>) -> Doc {
    if v.len() == 1 {
        v.pop().unwrap()
    } else {
        concat(v)
    }
}

fn open_tag_doc(e: &Element, holes: &[String]) -> Doc {
    let self_close = is_self_closing(e);

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
        let s: Vec<String> = statics
            .iter()
            .map(std::string::ToString::to_string)
            .collect();
        let h: Vec<String> = holes.iter().map(std::string::ToString::to_string).collect();
        format_template(
            &s,
            &h,
            &Options {
                width: 80,
                tab_width: 4,
                ..Options::default()
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
        let out = fmt(&["<pre>  a\n  b  </pre>"], &[]);
        assert!(out.contains("  a\n  b  "), "pre kept verbatim: {out:?}");
    }

    #[test]
    fn mixed_inline_content_stays_in_flow() {
        assert_eq!(
            fmt(&["<p>hi <b>there</b> friend</p>"], &[]),
            "<p>hi <b>there</b> friend</p>"
        );
    }

    #[test]
    fn touching_inline_content_is_not_split() {
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
