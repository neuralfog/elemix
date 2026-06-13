//! Stage 2 — the mini HTML parser.
//!
//! Walks the located template (its static string segments + the `${...}` hole
//! expressions between them) and produces:
//!   * `markup` — the static HTML for `template()`: static attributes kept,
//!     dynamic attributes stripped, every content hole replaced by a `<!---->`
//!     anchor, formatting whitespace between tags collapsed.
//!   * `holes`  — each hole positioned by a `NodePath` + `Slot` + verbatim expr.
//!
//! It stays purely structural: an attribute hole becomes one `Slot::Attr`
//! binding (the whole value reconstructed as one expression, a template literal
//! when it mixes statics and holes); each content `${}` becomes its own
//! `Slot::Content` anchor. Splitting `Content` into Text/List/Child/Splice is
//! the grammar's job.

use super::node::{Hole, NodePath, Slot, Step};

/// Output of stage 2: static markup + holes resolved to a node path and slot.
#[derive(Debug)]
pub struct ParsedTemplate {
    pub markup: String,
    pub holes: Vec<Hole>,
}

/// HTML void elements — self-closing with no end tag. Matches the renderer's
/// battle-tested `VOID_ELEMENTS` set; a non-void self-closed tag (`<user-card/>`)
/// must be expanded to an explicit close or HTML parses the next sibling as its
/// child (the `fixSelfClosing` rule, applied here at serialize time).
const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track",
    "wbr",
];

/// A piece of an attribute value: literal text or an interpolated expression.
enum Part {
    Static(String),
    Hole(String),
}

/// A node in the parsed tree.
enum Child {
    Elem(El),
    Text(String),
    Anchor(String), // content-hole expression
}

struct El {
    tag: String,
    static_attrs: String, // serialized, e.g. ` class="x" type="text"`
    attr_holes: Vec<(String, String)>, // (name-with-sigil, reconstructed expr)
    children: Vec<Child>,
    self_closing: bool,
}

impl El {
    fn new() -> Self {
        El {
            tag: String::new(),
            static_attrs: String::new(),
            attr_holes: Vec::new(),
            children: Vec::new(),
            self_closing: false,
        }
    }
}

#[derive(PartialEq, Clone, Copy)]
enum St {
    Text,
    TagName,
    BeforeAttr,
    AttrName,
    AfterAttrName,
    BeforeValue,
    ValueQuoted,
    ValueUnquoted,
    SelfClose,
    CloseTag,
    Comment,
}

struct Parser {
    st: St,
    stack: Vec<El>, // stack[0] is the synthetic root; its children are top-level
    text: String,   // pending text run for the current open element
    cur: El,        // the open tag currently being parsed
    close_name: String,
    // current attribute under construction
    a_name: String,
    a_val: String,
    a_parts: Vec<Part>,
    a_has_value: bool,
    a_has_hole: bool,
    quote: char,
}

impl Parser {
    fn new() -> Self {
        Parser {
            st: St::Text,
            stack: vec![El::new()],
            text: String::new(),
            cur: El::new(),
            close_name: String::new(),
            a_name: String::new(),
            a_val: String::new(),
            a_parts: Vec::new(),
            a_has_value: false,
            a_has_hole: false,
            quote: '"',
        }
    }

    fn parent(&mut self) -> &mut El {
        self.stack.last_mut().unwrap()
    }

    fn flush_text(&mut self) {
        if !self.text.is_empty() {
            let t = std::mem::take(&mut self.text);
            self.parent().children.push(Child::Text(t));
        }
    }

    fn reset_attr(&mut self) {
        self.a_name.clear();
        self.a_val.clear();
        self.a_parts.clear();
        self.a_has_value = false;
        self.a_has_hole = false;
    }

    /// Finalize the attribute currently being parsed onto `cur`.
    fn finish_attr(&mut self) {
        if self.a_name.is_empty() {
            return;
        }
        if !self.a_has_value {
            self.cur.static_attrs.push(' ');
            self.cur.static_attrs.push_str(&self.a_name);
        } else if self.a_has_hole {
            if !self.a_val.is_empty() {
                self.a_parts
                    .push(Part::Static(std::mem::take(&mut self.a_val)));
            }
            let expr = reconstruct(&self.a_parts);
            let name = self.a_name.clone();
            self.cur.attr_holes.push((name, expr));
        } else {
            self.cur.static_attrs.push(' ');
            self.cur.static_attrs.push_str(&self.a_name);
            self.cur.static_attrs.push_str("=\"");
            self.cur.static_attrs.push_str(&self.a_val);
            self.cur.static_attrs.push('"');
        }
        self.reset_attr();
    }

    /// Finish the open tag in `cur`: push as a leaf (void/self-closing) or onto
    /// the stack as the new open element.
    fn finish_open_tag(&mut self) {
        let void = VOID.contains(&self.cur.tag.as_str());
        let leaf = void || self.cur.self_closing;
        let mut el = std::mem::replace(&mut self.cur, El::new());
        if leaf {
            el.self_closing = true;
            self.parent().children.push(Child::Elem(el));
        } else {
            self.stack.push(el);
        }
        self.st = St::Text;
    }

    fn close_element(&mut self) {
        self.flush_text();
        if self.stack.len() > 1 {
            let el = self.stack.pop().unwrap();
            self.parent().children.push(Child::Elem(el));
        }
        self.close_name.clear();
        self.st = St::Text;
    }

    /// Scan one static segment.
    fn feed_static(&mut self, s: &str) {
        let chars: Vec<char> = s.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            match self.st {
                St::Text => {
                    if c == '<' {
                        if chars.get(i + 1) == Some(&'/') {
                            self.flush_text();
                            self.st = St::CloseTag;
                            self.close_name.clear();
                            i += 2;
                            continue;
                        } else if chars.get(i + 1) == Some(&'!') {
                            self.flush_text();
                            self.st = St::Comment;
                            i += 2;
                            continue;
                        }
                        self.flush_text();
                        self.cur = El::new();
                        self.st = St::TagName;
                        i += 1;
                        continue;
                    }
                    self.text.push(c);
                    i += 1;
                }
                St::TagName => {
                    if c.is_whitespace() {
                        self.st = St::BeforeAttr;
                    } else if c == '/' {
                        self.cur.self_closing = true;
                        self.st = St::SelfClose;
                    } else if c == '>' {
                        self.finish_open_tag();
                    } else {
                        self.cur.tag.push(c);
                    }
                    i += 1;
                }
                St::BeforeAttr => {
                    if c.is_whitespace() {
                        i += 1;
                    } else if c == '>' {
                        self.finish_open_tag();
                        i += 1;
                    } else if c == '/' {
                        self.cur.self_closing = true;
                        self.st = St::SelfClose;
                        i += 1;
                    } else {
                        self.reset_attr();
                        self.a_name.push(c);
                        self.st = St::AttrName;
                        i += 1;
                    }
                }
                St::AttrName => {
                    if c == '=' {
                        self.a_has_value = true;
                        self.st = St::BeforeValue;
                        i += 1;
                    } else if c.is_whitespace() {
                        self.st = St::AfterAttrName;
                        i += 1;
                    } else if c == '>' || c == '/' {
                        self.finish_attr();
                        self.st = St::BeforeAttr; // reprocess terminator
                    } else {
                        self.a_name.push(c);
                        i += 1;
                    }
                }
                St::AfterAttrName => {
                    if c.is_whitespace() {
                        i += 1;
                    } else if c == '=' {
                        self.a_has_value = true;
                        self.st = St::BeforeValue;
                        i += 1;
                    } else {
                        // boolean attribute; start the next one / end the tag
                        self.finish_attr();
                        self.st = St::BeforeAttr;
                    }
                }
                St::BeforeValue => {
                    if c.is_whitespace() {
                        i += 1;
                    } else if c == '"' || c == '\'' {
                        self.quote = c;
                        self.st = St::ValueQuoted;
                        i += 1;
                    } else {
                        self.st = St::ValueUnquoted;
                    }
                }
                St::ValueQuoted => {
                    if c == self.quote {
                        self.finish_attr();
                        self.st = St::BeforeAttr;
                        i += 1;
                    } else {
                        self.a_val.push(c);
                        i += 1;
                    }
                }
                St::ValueUnquoted => {
                    if c.is_whitespace() || c == '>' || c == '/' {
                        self.finish_attr();
                        self.st = St::BeforeAttr; // reprocess terminator
                    } else {
                        self.a_val.push(c);
                        i += 1;
                    }
                }
                St::SelfClose => {
                    if c == '>' {
                        self.finish_open_tag();
                    }
                    i += 1;
                }
                St::CloseTag => {
                    if c == '>' {
                        self.close_element();
                    } else {
                        self.close_name.push(c);
                    }
                    i += 1;
                }
                St::Comment => {
                    // drop everything up to and including `-->`
                    if c == '>' && i >= 2 && chars[i - 1] == '-' && chars[i - 2] == '-' {
                        self.st = St::Text;
                    }
                    i += 1;
                }
            }
        }
    }

    /// Handle a `${...}` hole arriving between two static segments.
    fn feed_hole(&mut self, expr: &str) {
        match self.st {
            St::Text => {
                self.flush_text();
                self.parent().children.push(Child::Anchor(expr.to_string()));
            }
            St::BeforeValue | St::ValueUnquoted | St::ValueQuoted => {
                if !self.a_val.is_empty() {
                    self.a_parts
                        .push(Part::Static(std::mem::take(&mut self.a_val)));
                }
                self.a_parts.push(Part::Hole(expr.to_string()));
                self.a_has_hole = true;
                if self.st == St::BeforeValue {
                    // a bare `name=${x}` value; the next static terminates it
                    self.st = St::ValueUnquoted;
                }
            }
            // a hole in a tag/attr-name position is disallowed (attributes-only);
            // ignore defensively.
            _ => {}
        }
    }
}

/// Build the value expression for a dynamic attribute. A single bare hole stays
/// raw; statics mixed with holes reconstruct a template literal.
fn reconstruct(parts: &[Part]) -> String {
    if let [Part::Hole(e)] = parts {
        return e.clone();
    }
    let mut out = String::from("`");
    for p in parts {
        match p {
            Part::Static(s) => out.push_str(&escape_tmpl(s)),
            Part::Hole(e) => {
                out.push_str("${");
                out.push_str(e);
                out.push('}');
            }
        }
    }
    out.push('`');
    out
}

fn escape_tmpl(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '`' => out.push_str("\\`"),
            '$' => out.push_str("\\$"),
            _ => out.push(c),
        }
    }
    out
}

/// Collapse formatting whitespace in an element's child list: runs collapse to a
/// single space, leading/trailing text on the element trims, and a lone space
/// between two non-inline nodes (tag↔tag) is dropped — but kept next to a hole.
fn normalize(children: &mut Vec<Child>) {
    for ch in children.iter_mut() {
        match ch {
            Child::Text(t) => *t = collapse_ws(t),
            Child::Elem(e) => normalize(&mut e.children),
            Child::Anchor(_) => {}
        }
    }
    if let Some(Child::Text(t)) = children.first_mut() {
        *t = t.trim_start().to_string();
    }
    if let Some(Child::Text(t)) = children.last_mut() {
        *t = t.trim_end().to_string();
    }
    let n = children.len();
    let mut keep = Vec::with_capacity(n);
    for idx in 0..n {
        let drop = match &children[idx] {
            Child::Text(t) if t.is_empty() => true,
            Child::Text(t) if t == " " => {
                let left_inline = idx
                    .checked_sub(1)
                    .map(|j| matches!(children[j], Child::Anchor(_)))
                    .unwrap_or(false);
                let right_inline = children
                    .get(idx + 1)
                    .map(|c| matches!(c, Child::Anchor(_)))
                    .unwrap_or(false);
                !(left_inline || right_inline)
            }
            _ => false,
        };
        keep.push(!drop);
    }
    let mut idx = 0;
    children.retain(|_| {
        let k = keep[idx];
        idx += 1;
        k
    });
}

fn collapse_ws(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_ws = false;
    for c in s.chars() {
        if c.is_whitespace() {
            if !in_ws {
                out.push(' ');
                in_ws = true;
            }
        } else {
            out.push(c);
            in_ws = false;
        }
    }
    out
}

/// Walk the tree producing markup + holes positioned by path.
fn serialize(children: &[Child], path: &NodePath, markup: &mut String, holes: &mut Vec<Hole>) {
    let mut child_count = 0usize; // element index (.children[i])
    let mut node_count = 0usize; // node index (.childNodes[i])
    for child in children {
        match child {
            Child::Text(t) => {
                markup.push_str(t);
                node_count += 1;
            }
            Child::Anchor(expr) => {
                markup.push_str("<!---->");
                let mut p = path.clone();
                p.push(Step::ChildNode(node_count));
                holes.push(Hole {
                    path: p,
                    slot: Slot::Content,
                    expr: expr.clone(),
                });
                node_count += 1;
            }
            Child::Elem(el) => {
                let mut elem_path = path.clone();
                elem_path.push(Step::Child(child_count));
                for (name, expr) in &el.attr_holes {
                    holes.push(Hole {
                        path: elem_path.clone(),
                        slot: Slot::Attr(name.clone()),
                        expr: expr.clone(),
                    });
                }
                markup.push('<');
                markup.push_str(&el.tag);
                markup.push_str(&el.static_attrs);
                if el.self_closing && VOID.contains(&el.tag.as_str()) {
                    // void elements: `<input/>` is valid HTML
                    markup.push_str("/>");
                } else if el.self_closing {
                    // a non-void self-closed element (`<user-card/>`, `<circle/>`)
                    // — HTML ignores the `/`, so expand to an explicit close or
                    // the next sibling gets parsed as a child.
                    markup.push_str("></");
                    markup.push_str(&el.tag);
                    markup.push('>');
                } else {
                    markup.push('>');
                    serialize(&el.children, &elem_path, markup, holes);
                    markup.push_str("</");
                    markup.push_str(&el.tag);
                    markup.push('>');
                }
                child_count += 1;
                node_count += 1;
            }
        }
    }
}

/// Parse a located template into static markup plus positioned holes.
pub fn parse(statics: &[String], holes: &[String]) -> ParsedTemplate {
    let mut p = Parser::new();
    for (i, s) in statics.iter().enumerate() {
        p.feed_static(s);
        if i < holes.len() {
            p.feed_hole(&holes[i]);
        }
    }
    p.flush_text();
    let mut root = p.stack.swap_remove(0);
    normalize(&mut root.children);

    let mut markup = String::new();
    let mut out_holes = Vec::new();
    serialize(&root.children, &Vec::new(), &mut markup, &mut out_holes);
    ParsedTemplate {
        markup,
        holes: out_holes,
    }
}
