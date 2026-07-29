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
use oxc_span::Span;

/// A hole expression paired with its absolute span in the original source — the
/// span-aware input to [`parse_spanned`]. The plain [`parse`] entry uses
/// [`Span::default`] for every hole (the compile path ignores spans).
pub struct SpannedHole {
    pub expr: String,
    pub span: Span,
}

/// Output of stage 2: static markup + holes resolved to a node path and slot.
#[derive(Debug)]
pub struct ParsedTemplate {
    pub markup: String,
    pub holes: Vec<Hole>,
    /// Exactly one top-level node and it is an element — the clone can target the
    /// element directly (no fragment wrapper, no root `.firstElementChild` walk).
    pub single_root: bool,
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
    Hole(String, Span),
}

/// A node in the parsed tree.
enum Child {
    Elem(El),
    Text(String),
    Anchor(String, Span), // content-hole expression + its span
}

struct El {
    tag: String,
    static_attrs: String, // serialized, e.g. ` class="x" type="text"`
    attr_holes: Vec<(String, String, Span)>, // (name-with-sigil, reconstructed expr, span)
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

/// Build the value expression for a dynamic attribute, with a representative
/// span. A single bare hole stays raw and carries its exact span; statics mixed
/// with holes reconstruct a template literal and carry the first hole's span
/// (good enough — mixed attrs are string-coercible and the analyzer skips them).
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

/// Collapse formatting whitespace in an element's child list: runs collapse to a
/// single space, leading/trailing text on the element trims, and a lone space
/// between two non-inline nodes (tag↔tag) is dropped — but kept next to a hole.
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
                    .map(|j| matches!(children[j], Child::Anchor(..)))
                    .unwrap_or(false);
                let right_inline = children
                    .get(idx + 1)
                    .map(|c| matches!(c, Child::Anchor(..)))
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
    // A lone content hole has no sibling text node to merge with, so a plain text
    // value can be baked as a real text node instead of a `<!---->` swap.
    let sole = children.len() == 1;
    let mut node_count = 0usize; // node index (.childNodes[i]) — used for all steps
                                 // Server-DOM node accounting: text and text-content holes collapse into ONE
                                 // server text node, so a run's server index lags `node_count` once anything
                                 // ahead of it merged. `run_open`/`run_start` track the currently open run so a
                                 // text hole records the server index of the run node it lands in.
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
                node_count += 1;
            }
        }
    }
}

/// Walk the tree producing an SSR template-literal body: static HTML plus
/// `${...}` interpolations that call the SSR runtime helpers. Mirrors [`serialize`]
/// but emits string content destined for a JS template literal (backticks are
/// added by the caller) rather than DOM-clone markup + positioned holes.
///
/// Hole handling:
///   * Text content → `${$__ssrText(expr)}`.
///   * List/Child content (`repeat`/`when`/`choose`/`match`, ternary/nested `tpl`)
///     → SSR-lowered to a string via [`crate::ssr_expr::rewrite_content_expr`].
///   * A nested component (`<my-tag>`) → `${$__ssrChild('my-tag', {props}, slot)}`.
///   * Attr/Class/Style attribute holes → `name="${$__ssrAttr(expr)}"`.
///   * Event/Model/OnModel/Prop/Ref attribute holes → dropped (client wiring).
///
/// The dropped set is matched by the same sigils [`crate::grammar`] classifies
/// on (`@` → event, `~` → model/onmodel, `:` → prop and `:ref` → ref); every one
/// of those is client-only and has no server-rendered form.
fn serialize_ssr(children: &[Child], out: &mut String, counter: &mut usize, hydratable: bool) {
    for child in children {
        match child {
            Child::Text(t) => out.push_str(&esc_tpl(t)),
            Child::Anchor(expr, _) => {
                if crate::grammar::is_text_content(expr) {
                    out.push_str(&format!("${{$__ssrText({expr})}}"));
                } else {
                    // A directive hole (`repeat`/`when`/`choose`/`match`) or a
                    // nested `tpl` - SSR-lower it to a string (slice 3). The
                    // rewrite renders any nested `tpl` and reaches components
                    // through directives via `$__ssrChild`.
                    out.push_str("${");
                    out.push_str(&crate::ssr_expr::rewrite_content_expr(expr));
                    out.push('}');
                }
            }
            // A hyphenated tag is a custom element - a nested elemix component.
            // Render its own `$$__ssr()` inline via `$__ssrChild`, forwarding
            // `:prop` bindings and projecting light-DOM children as slot content.
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
                let mut slot = String::new();
                serialize_ssr(&el.children, &mut slot, counter, hydratable);
                // Static attributes on the host (e.g. `name="rating"` on a
                // form-associated child) must render too - the child's own
                // `$$__ssr()` can't know them, so pass them for `$__ssrChild` to
                // splice onto the host tag (like `data-h`).
                let attrs = esc_tpl(&el.static_attrs);
                out.push_str("${$__ssrChild('");
                out.push_str(&el.tag);
                out.push_str("', {");
                out.push_str(&props);
                out.push('}');
                if !attrs.is_empty() {
                    out.push_str(", `");
                    out.push_str(&slot);
                    out.push_str("`, `");
                    out.push_str(&attrs);
                    out.push('`');
                } else if !slot.is_empty() {
                    out.push_str(", `");
                    out.push_str(&slot);
                    out.push('`');
                }
                out.push_str(")}");
            }
            Child::Elem(el) => serialize_element(el, out, counter, hydratable),
        }
    }
}

/// Serialize a regular (non-component) element for SSR. When it has dynamic text
/// content among its direct children, wrap it in an IIFE that evaluates each value
/// ONCE, stamps a `data-t` attribute holding the rendered (unescaped) lengths, and
/// inlines the values - so the served HTML carries NO `<!---->` markers and
/// hydration recovers the dynamic text nodes by splitting the merged run at those
/// lengths. Elements without dynamic text serialize flat.
fn serialize_element(el: &El, out: &mut String, counter: &mut usize, hydratable: bool) {
    if el.self_closing {
        out.push('<');
        out.push_str(&el.tag);
        out.push_str(&esc_tpl(&el.static_attrs));
        emit_attr_holes(el, out);
        if VOID.contains(&el.tag.as_str()) {
            out.push_str("/>");
        } else {
            out.push_str("></");
            out.push_str(&el.tag);
            out.push('>');
        }
        return;
    }

    // A lone text hole bakes straight into the element's text node (matching the
    // CSR template), so hydration grabs it directly - no `data-t`, no split. Only
    // text holes MERGED with sibling static/holes need the markerless machinery.
    // Non-hydratable content (inside a structural region - never split-hydrated)
    // skips `data-t` entirely and serializes flat.
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
        out.push('<');
        out.push_str(&el.tag);
        out.push_str(&esc_tpl(&el.static_attrs));
        emit_attr_holes(el, out);
        out.push('>');
        serialize_ssr(&el.children, out, counter, hydratable);
        out.push_str("</");
        out.push_str(&el.tag);
        out.push('>');
        return;
    }

    let base = *counter;
    *counter += text_count;
    out.push_str("${(() => {");
    let mut ti = 0;
    for child in &el.children {
        if let Child::Anchor(e, _) = child {
            if crate::grammar::is_text_content(e) {
                out.push_str(&format!("const _t{} = ({e});", base + ti));
                ti += 1;
            }
        }
    }
    out.push_str("return `<");
    out.push_str(&el.tag);
    out.push_str(&esc_tpl(&el.static_attrs));
    emit_attr_holes(el, out);
    out.push_str(" data-t=\"");
    for i in 0..text_count {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!("${{$__ssrLen(_t{})}}", base + i));
    }
    out.push_str("\">");
    let mut tj = 0;
    for child in &el.children {
        match child {
            Child::Text(t) => out.push_str(&esc_tpl(t)),
            Child::Anchor(e, _) if crate::grammar::is_text_content(e) => {
                out.push_str(&format!("${{$__ssrText(_t{})}}", base + tj));
                tj += 1;
            }
            Child::Anchor(e, _) => {
                out.push_str("${");
                out.push_str(&crate::ssr_expr::rewrite_content_expr(e));
                out.push('}');
            }
            _ => serialize_ssr(std::slice::from_ref(child), out, counter, hydratable),
        }
    }
    out.push_str("</");
    out.push_str(&el.tag);
    out.push_str(">`;})()}");
}

fn emit_attr_holes(el: &El, out: &mut String) {
    for (name, expr, _) in &el.attr_holes {
        // `~model` two-way binds a ref to the input. It's client wiring, but the
        // ref's CURRENT value must render server-side as the `value` attribute -
        // otherwise the input paints empty then fills on hydrate (a flash). The
        // hydrating `$__model` sees `el.value === ref.value` and skips its write,
        // so a matching server value means no flash and no clobber.
        if name == "~model" {
            out.push_str(&format!("${{$__ssrAttr('value', ({expr}).value)}}"));
            continue;
        }
        // Other sigil-carrying holes are client-only wiring - drop them (`@` event,
        // `~onmodel` transform, `:` prop/ref).
        if name.starts_with('@') || name.starts_with('~') || name.starts_with(':') {
            continue;
        }
        // Each helper returns the WHOLE ` name="value"` fragment (or ""), matching
        // the CSR `$__setAttr`/`$__setClass`/`$__setStyle` presence semantics: a
        // `false`/`null`/`undefined` attr is omitted, `true` is bare, a class/style
        // object resolves to its string, and an empty class/style drops the attr.
        match name.as_str() {
            "class" => out.push_str(&format!("${{$__ssrClass({expr})}}")),
            "style" => out.push_str(&format!("${{$__ssrStyle({expr})}}")),
            _ => out.push_str(&format!("${{$__ssrAttr('{name}', {expr})}}")),
        }
    }
}

/// Escape the three JS template-literal metacharacters so a static HTML run sits
/// verbatim inside the SSR `` `...` `` string: `\` → `\\`, `` ` `` → `` \` ``, and
/// only the `$` that opens an interpolation (`${`) → `\${`.
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

/// Build the SSR template-literal body for one component template: the static
/// HTML with `${...}` interpolations that call the SSR runtime helpers. Backticks
/// are added by the caller ([`crate::ssr::ssr_method`]). Constructs the node tree
/// exactly like [`parse_spanned`], then serializes via [`serialize_ssr`].
pub fn ssr_inner(statics: &[String], holes: &[String]) -> String {
    ssr_body(statics, holes, true)
}

/// Serialize a nested `` tpl`…` `` (found inside a structural content hole) to a
/// backtick-wrapped SSR string literal. `hydratable = false`: content in a
/// structural region is server-rendered but never split-hydrated, so no `data-t`
/// machinery is emitted (text holes inline as `${$__ssrText(...)}`). Used by
/// [`crate::ssr_expr::rewrite_content_expr`].
pub fn ssr_nested_tpl(statics: &[String], holes: &[String]) -> String {
    format!("`{}`", ssr_body(statics, holes, false))
}

/// Build the SSR template-literal body from a template's statics + holes.
/// `hydratable` gates the markerless `data-t` machinery: `true` at the top level
/// (the component's own reactive text hydrates), `false` inside a structural
/// region.
fn ssr_body(statics: &[String], holes: &[String], hydratable: bool) -> String {
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

    let mut out = String::new();
    let mut counter = 0;
    serialize_ssr(&root.children, &mut out, &mut counter, hydratable);
    out
}

/// A top-level structural content hole (`repeat`/`when`/`choose`/`match` or a
/// ternary / nested `tpl`) located for HYDRATION. SSR renders its content inline
/// (markerless - no anchor in the served HTML); hydration reconstructs the anchor
/// and takes the region over with the normal CSR `$__child`/`$__list` builder.
///
/// `parent` is the node path to the hole's parent element (empty = the fragment
/// root, i.e. the hydrate `root`). `before`/`after` are the static sibling node
/// counts flanking the hole in that parent - the runtime uses them to carve the
/// server-rendered content region back out. `list` is `true` for a `repeat`
/// (`$__list`), `false` for a single child (`$__child`).
pub struct StructHole {
    pub parent: NodePath,
    pub before: usize,
    pub after: usize,
    pub expr: String,
    pub list: bool,
}

/// Locate every TOP-LEVEL structural content hole for hydration. Text holes,
/// attribute holes and holes nested inside another structural region (they live
/// in an expression string, not the node tree, and are rebuilt wholesale by the
/// takeover) are excluded. Component elements are opaque (one host node), not
/// recursed into.
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
            // Recurse into regular (non-component) elements only. A component host
            // is one opaque node; a structural hole in its slotted light DOM is not
            // hydrated here.
            Child::Elem(el) if !el.tag.contains('-') => {
                let mut child_path = path.clone();
                child_path.push(Step::Child(idx));
                collect_struct(&el.children, &child_path, out);
            }
            _ => {}
        }
    }
}

/// Parse a located template into static markup plus positioned holes. Hole spans
/// default to empty — the compile path works on expr strings and never reads
/// them. The analyzer wants real spans, so it calls [`parse_spanned`].
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

/// Like [`parse`], but each hole carries its absolute source span so located
/// holes can be caret-mapped back to the original template (the analyzer path).
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
