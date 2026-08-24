use super::node::{Hole, NodePath, Slot, Step};
use oxc_span::Span;

pub struct SpannedHole {
    pub expr: String,
    pub span: Span,
}

#[derive(Debug)]
pub struct ParsedTemplate {
    pub markup: String,
    pub holes: Vec<Hole>,
    pub single_root: bool,
}

const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track",
    "wbr",
];

enum Part {
    Static(String),
    Hole(String, Span),
}

enum Child {
    Elem(El),
    Text(String),
    Anchor(String, Span),
}

struct El {
    tag: String,
    static_attrs: String,
    attr_holes: Vec<(String, String, Span)>,
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
    stack: Vec<El>,
    text: String,
    cur: El,
    close_name: String,
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
            let (expr, span) = reconstruct(&self.a_parts);
            let name = self.a_name.clone();
            self.cur.attr_holes.push((name, expr, span));
        } else {
            self.cur.static_attrs.push(' ');
            self.cur.static_attrs.push_str(&self.a_name);
            self.cur.static_attrs.push_str("=\"");
            self.cur.static_attrs.push_str(&self.a_val);
            self.cur.static_attrs.push('"');
        }
        self.reset_attr();
    }

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
                        self.st = St::BeforeAttr;
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
                        self.st = St::BeforeAttr;
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
                    if c == '>' && i >= 2 && chars[i - 1] == '-' && chars[i - 2] == '-' {
                        self.st = St::Text;
                    }
                    i += 1;
                }
            }
        }
    }

    fn feed_hole(&mut self, expr: &str, span: Span) {
        match self.st {
            St::Text => {
                self.flush_text();
                self.parent()
                    .children
                    .push(Child::Anchor(expr.to_string(), span));
            }
            St::BeforeValue | St::ValueUnquoted | St::ValueQuoted => {
                if !self.a_val.is_empty() {
                    self.a_parts
                        .push(Part::Static(std::mem::take(&mut self.a_val)));
                }
                self.a_parts.push(Part::Hole(expr.to_string(), span));
                self.a_has_hole = true;
                if self.st == St::BeforeValue {
                    self.st = St::ValueUnquoted;
                }
            }
            _ => {}
        }
    }
}

fn reconstruct(parts: &[Part]) -> (String, Span) {
    if let [Part::Hole(e, span)] = parts {
        return (e.clone(), *span);
    }
    let first = parts
        .iter()
        .find_map(|p| match p {
            Part::Hole(_, span) => Some(*span),
            _ => None,
        })
        .unwrap_or_default();
    let mut out = String::from("`");
    for p in parts {
        match p {
            Part::Static(s) => out.push_str(&escape_tmpl(s)),
            Part::Hole(e, _) => {
                out.push_str("${");
                out.push_str(e);
                out.push('}');
            }
        }
    }
    out.push('`');
    (out, first)
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

fn normalize(children: &mut Vec<Child>) {
    for ch in children.iter_mut() {
        match ch {
            Child::Text(t) => *t = collapse_ws(t),
            Child::Elem(e) => normalize(&mut e.children),
            Child::Anchor(..) => {}
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
                    .is_some_and(|j| matches!(children[j], Child::Anchor(..)));
                let right_inline = children
                    .get(idx + 1)
                    .is_some_and(|c| matches!(c, Child::Anchor(..)));
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

fn serialize(children: &[Child], path: &NodePath, markup: &mut String, holes: &mut Vec<Hole>) {
    let sole = children.len() == 1;
    let mut node_count = 0usize;
    let mut server_count = 0usize;
    let mut run_open = false;
    let mut run_start = 0usize;
    for (idx, child) in children.iter().enumerate() {
        match child {
            Child::Text(t) => {
                markup.push_str(t);
                if !run_open {
                    run_open = true;
                    run_start = server_count;
                }
                node_count += 1;
            }
            Child::Anchor(expr, span) => {
                let mut p = path.clone();
                p.push(Step::ChildNode(node_count));
                let prefix = match idx.checked_sub(1).and_then(|i| children.get(i)) {
                    Some(Child::Text(t)) => t.chars().count(),
                    _ => 0,
                };
                let run_index = if crate::grammar::is_text_content(expr) {
                    if !run_open {
                        run_open = true;
                        run_start = server_count;
                    }
                    run_start
                } else {
                    if run_open {
                        server_count += 1;
                        run_open = false;
                    }
                    let own = server_count;
                    server_count += 1;
                    own
                };
                if sole && crate::grammar::is_text_content(expr) {
                    markup.push(' ');
                    holes.push(Hole {
                        path: p,
                        slot: Slot::Text,
                        expr: expr.clone(),
                        span: *span,
                        tag: None,
                        prefix,
                        run_index,
                    });
                } else {
                    markup.push_str("<!---->");
                    holes.push(Hole {
                        path: p,
                        slot: Slot::Content,
                        expr: expr.clone(),
                        span: *span,
                        tag: None,
                        prefix,
                        run_index,
                    });
                }
                node_count += 1;
            }
            Child::Elem(el) => {
                if run_open {
                    server_count += 1;
                    run_open = false;
                }
                server_count += 1;
                let mut elem_path = path.clone();
                elem_path.push(Step::Child(node_count));
                for (name, expr, span) in &el.attr_holes {
                    holes.push(Hole {
                        path: elem_path.clone(),
                        slot: Slot::Attr(name.clone()),
                        expr: expr.clone(),
                        span: *span,
                        tag: Some(el.tag.clone()),
                        prefix: 0,
                        run_index: 0,
                    });
                }
                markup.push('<');
                markup.push_str(&el.tag);
                markup.push_str(&el.static_attrs);
                if el.self_closing && VOID.contains(&el.tag.as_str()) {
                    markup.push_str("/>");
                } else if el.self_closing {
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
                node_count += 1;
            }
        }
    }
}

pub enum Chunk {
    Static(String),
    Content(String),
}

pub struct Rope {
    pub chunks: Vec<Chunk>,
}

impl Default for Rope {
    fn default() -> Self {
        Self::new()
    }
}

impl Rope {
    pub fn new() -> Self {
        Rope { chunks: Vec::new() }
    }

    pub fn static_str(&mut self, s: &str) {
        if s.is_empty() {
            return;
        }
        if let Some(Chunk::Static(last)) = self.chunks.last_mut() {
            last.push_str(s);
        } else {
            self.chunks.push(Chunk::Static(s.to_string()));
        }
    }

    pub fn content(&mut self, expr: String) {
        self.chunks.push(Chunk::Content(expr));
    }

    pub fn extend(&mut self, other: Vec<Chunk>) {
        for c in other {
            match c {
                Chunk::Static(s) => self.static_str(&s),
                Chunk::Content(e) => self.content(e),
            }
        }
    }
}

fn fmt_chunk(c: &Chunk) -> String {
    match c {
        Chunk::Static(s) => format!("`{s}`"),
        Chunk::Content(e) => e.clone(),
    }
}

pub fn fmt_array(chunks: &[Chunk]) -> String {
    let parts: Vec<String> = chunks.iter().map(fmt_chunk).collect();
    format!("[{}]", parts.join(", "))
}

fn fmt_rope(chunks: &[Chunk]) -> String {
    match chunks.len() {
        0 => "''".to_string(),
        1 => fmt_chunk(&chunks[0]),
        _ => fmt_array(chunks),
    }
}

fn collect_slot_names(children: &[Child]) -> Vec<String> {
    let mut names = Vec::new();
    for child in children {
        if let Child::Elem(el) = child {
            if let Some(name) = static_attr_value(&el.static_attrs, "slot") {
                names.push(name);
            }
        }
    }
    names
}

fn static_attr_value(attrs: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=\"");
    let at = attrs.find(&needle)?;
    if at > 0 && !attrs.as_bytes()[at - 1].is_ascii_whitespace() {
        return None;
    }
    let rest = &attrs[at + needle.len()..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn emit_child(tag: &str, props: &str, slot: &[Chunk], attrs: &str, names: &[String]) -> String {
    let mut args = vec![format!("'{tag}'"), format!("{{{props}}}")];
    let need_names = !names.is_empty();
    let need_attrs = !attrs.is_empty() || need_names;
    let need_slot = !slot.is_empty() || need_attrs;
    if need_slot {
        args.push(if slot.is_empty() {
            "undefined".to_string()
        } else {
            fmt_rope(slot)
        });
    }
    if need_attrs {
        args.push(if attrs.is_empty() {
            "''".to_string()
        } else {
            format!("`{attrs}`")
        });
    }
    if need_names {
        let list: Vec<String> = names.iter().map(|n| format!("'{n}'")).collect();
        args.push(format!("[{}]", list.join(", ")));
    }
    format!("$__ssrChild({})", args.join(", "))
}

fn serialize_ssr(children: &[Child], r: &mut Rope, counter: &mut usize, hydratable: bool) {
    let regions: Vec<&String> = children
        .iter()
        .filter_map(|c| match c {
            Child::Anchor(e, _) if !crate::grammar::is_text_content(e) => Some(e),
            _ => None,
        })
        .collect();
    let multi_region = hydratable
        && regions.len() >= 2
        && regions
            .iter()
            .all(|e| e.trim_start().starts_with("repeat("));
    for child in children {
        match child {
            Child::Text(t) => r.static_str(&esc_tpl(t)),
            Child::Anchor(expr, _) => {
                if crate::grammar::is_text_content(expr) {
                    r.content(format!("$__ssrText({expr})"));
                } else {
                    r.content(crate::ssr_expr::rewrite_content_expr(expr));
                    if multi_region {
                        r.static_str("<!--$-->");
                    }
                }
            }
            Child::Elem(el) if el.tag.contains('-') => {
                let mut props = String::new();
                for (name, expr, _) in &el.attr_holes {
                    let Some(key) = name.strip_prefix(':') else {
                        continue;
                    };
                    if key == "ref" {
                        continue;
                    }
                    if !props.is_empty() {
                        props.push_str(", ");
                    }
                    props.push_str(key);
                    props.push_str(": (");
                    props.push_str(expr);
                    props.push(')');
                }
                let mut slot = Rope::new();
                serialize_ssr(&el.children, &mut slot, counter, hydratable);
                let attrs = esc_tpl(&el.static_attrs);
                let names = collect_slot_names(&el.children);
                r.content(emit_child(&el.tag, &props, &slot.chunks, &attrs, &names));
            }
            Child::Elem(el) => serialize_element(el, r, counter, hydratable),
        }
    }
}

fn serialize_element(el: &El, r: &mut Rope, counter: &mut usize, hydratable: bool) {
    if el.self_closing {
        r.static_str("<");
        r.static_str(&el.tag);
        r.static_str(&esc_tpl(&el.static_attrs));
        r.static_str(&attr_holes_str(el));
        if VOID.contains(&el.tag.as_str()) {
            r.static_str("/>");
        } else {
            r.static_str("></");
            r.static_str(&el.tag);
            r.static_str(">");
        }
        return;
    }

    let sole_baked = el.children.len() == 1
        && matches!(&el.children[0], Child::Anchor(e, _) if crate::grammar::is_text_content(e));
    let text_count = if !hydratable || sole_baked {
        0
    } else {
        el.children
            .iter()
            .filter(|c| matches!(c, Child::Anchor(e, _) if crate::grammar::is_text_content(e)))
            .count()
    };

    if text_count == 0 {
        r.static_str("<");
        r.static_str(&el.tag);
        r.static_str(&esc_tpl(&el.static_attrs));
        r.static_str(&attr_holes_str(el));
        r.static_str(">");
        serialize_ssr(&el.children, r, counter, hydratable);
        r.static_str("</");
        r.static_str(&el.tag);
        r.static_str(">");
        return;
    }

    let base = *counter;
    *counter += text_count;
    let has_content = el.children.iter().any(|c| match c {
        Child::Anchor(e, _) => !crate::grammar::is_text_content(e),
        Child::Elem(_) => true,
        _ => false,
    });

    let mut decls = String::new();
    let mut ti = 0;
    for child in &el.children {
        if let Child::Anchor(e, _) = child {
            if crate::grammar::is_text_content(e) {
                decls.push_str(&format!("const _t{} = ({e});", base + ti));
                ti += 1;
            }
        }
    }

    let mut open = String::new();
    open.push('<');
    open.push_str(&el.tag);
    open.push_str(&esc_tpl(&el.static_attrs));
    open.push_str(&attr_holes_str(el));
    open.push_str(" data-t=\"");
    for i in 0..text_count {
        if i > 0 {
            open.push(',');
        }
        open.push_str(&format!("${{$__ssrLen(_t{})}}", base + i));
    }
    open.push_str("\">");
    let close = format!("</{}>", el.tag);

    if !has_content {
        let mut body = String::new();
        let mut tj = 0;
        for child in &el.children {
            match child {
                Child::Text(t) => body.push_str(&esc_tpl(t)),
                Child::Anchor(e, _) if crate::grammar::is_text_content(e) => {
                    body.push_str(&format!("${{$__ssrText(_t{})}}", base + tj));
                    tj += 1;
                }
                _ => {}
            }
        }
        r.static_str(&format!(
            "${{(() => {{{decls}return `{open}{body}{close}`;}})()}}"
        ));
        return;
    }

    let mut inner = Rope::new();
    inner.static_str(&open);
    let mut tj = 0;
    for child in &el.children {
        match child {
            Child::Text(t) => inner.static_str(&esc_tpl(t)),
            Child::Anchor(e, _) if crate::grammar::is_text_content(e) => {
                inner.static_str(&format!("${{$__ssrText(_t{})}}", base + tj));
                tj += 1;
            }
            Child::Anchor(e, _) => {
                inner.content(crate::ssr_expr::rewrite_content_expr(e));
            }
            _ => serialize_ssr(std::slice::from_ref(child), &mut inner, counter, hydratable),
        }
    }
    inner.static_str(&close);
    r.content(format!(
        "(() => {{{decls}return {};}})()",
        fmt_array(&inner.chunks)
    ));
}

fn attr_holes_str(el: &El) -> String {
    let mut out = String::new();
    for (name, expr, _) in &el.attr_holes {
        if name == "~model" {
            out.push_str(&format!("${{$__ssrAttr('value', ({expr}).value)}}"));
            continue;
        }
        if name.starts_with('@') || name.starts_with('~') || name.starts_with(':') {
            continue;
        }
        match name.as_str() {
            "class" => out.push_str(&format!("${{$__ssrClass({expr})}}")),
            "style" => out.push_str(&format!("${{$__ssrStyle({expr})}}")),
            _ => out.push_str(&format!("${{$__ssrAttr('{name}', {expr})}}")),
        }
    }
    out
}

pub fn esc_tpl(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => out.push_str("\\\\"),
            '`' => out.push_str("\\`"),
            '$' if chars.peek() == Some(&'{') => out.push_str("\\$"),
            _ => out.push(c),
        }
    }
    out
}

pub fn ssr_inner(statics: &[String], holes: &[String]) -> Vec<Chunk> {
    ssr_body(statics, holes, true)
}

pub fn ssr_nested_tpl(statics: &[String], holes: &[String]) -> String {
    let chunks = ssr_body(statics, holes, false);
    let parts: Vec<String> = chunks.iter().map(fmt_chunk).collect();
    format!("$__ssrTpl({})", parts.join(", "))
}

fn ssr_body(statics: &[String], holes: &[String], hydratable: bool) -> Vec<Chunk> {
    let mut p = Parser::new();
    for (i, s) in statics.iter().enumerate() {
        p.feed_static(s);
        if let Some(expr) = holes.get(i) {
            p.feed_hole(expr, Span::default());
        }
    }
    p.flush_text();
    let mut root = p.stack.swap_remove(0);
    normalize(&mut root.children);

    let mut r = Rope::new();
    let mut counter = 0;
    serialize_ssr(&root.children, &mut r, &mut counter, hydratable);
    r.chunks
}

pub struct StructHole {
    pub parent: NodePath,
    pub before: usize,
    pub after: usize,
    pub expr: String,
    pub list: bool,
}

pub fn structural_holes(statics: &[String], holes: &[String]) -> Vec<StructHole> {
    let mut p = Parser::new();
    for (i, s) in statics.iter().enumerate() {
        p.feed_static(s);
        if let Some(expr) = holes.get(i) {
            p.feed_hole(expr, Span::default());
        }
    }
    p.flush_text();
    let mut root = p.stack.swap_remove(0);
    normalize(&mut root.children);

    let mut out = Vec::new();
    collect_struct(&root.children, &Vec::new(), &mut out);
    out
}

fn collect_struct(children: &[Child], path: &NodePath, out: &mut Vec<StructHole>) {
    let total = children.len();
    for (idx, child) in children.iter().enumerate() {
        match child {
            Child::Anchor(expr, _) if !crate::grammar::is_text_content(expr) => {
                out.push(StructHole {
                    parent: path.clone(),
                    before: idx,
                    after: total - idx - 1,
                    expr: expr.clone(),
                    list: expr.trim_start().starts_with("repeat("),
                });
            }
            Child::Elem(el) if !el.tag.contains('-') => {
                let mut child_path = path.clone();
                child_path.push(Step::Child(idx));
                collect_struct(&el.children, &child_path, out);
            }
            _ => {}
        }
    }
}

pub fn parse(statics: &[String], holes: &[String]) -> ParsedTemplate {
    let spanned: Vec<SpannedHole> = holes
        .iter()
        .map(|e| SpannedHole {
            expr: e.clone(),
            span: Span::default(),
        })
        .collect();
    parse_spanned(statics, &spanned)
}

pub fn parse_spanned(statics: &[String], holes: &[SpannedHole]) -> ParsedTemplate {
    let mut p = Parser::new();
    for (i, s) in statics.iter().enumerate() {
        p.feed_static(s);
        if let Some(hole) = holes.get(i) {
            p.feed_hole(&hole.expr, hole.span);
        }
    }
    p.flush_text();
    let mut root = p.stack.swap_remove(0);
    normalize(&mut root.children);

    let single_root = root.children.len() == 1 && matches!(root.children[0], Child::Elem(_));

    let mut markup = String::new();
    let mut out_holes = Vec::new();
    serialize(&root.children, &Vec::new(), &mut markup, &mut out_holes);
    ParsedTemplate {
        markup,
        holes: out_holes,
        single_root,
    }
}
