//! Stage 3 — the grammar: classify a hole into a binding.
//!
//! Two axes decide the kind: WHERE the hole sits (`Slot`) and, for attributes,
//! the name's sigil; for content holes, the value-shape of the expression.
//! Adding a binding later = one `BindingKind` variant + one `classify` arm +
//! one `Emitter` method.

use crate::template::node::{Hole, NodePath, Slot};

/// The closed set of bindings — mirrors the runtime primitives 1:1.
#[derive(Debug, Clone, PartialEq)]
pub enum BindingKind {
    Text,    // `${x}` text          → _text
    Attr,    // `name=${x}` (bare)   → _attr   (attributes-only rule)
    Class,   // `class=${x}`         → _class
    Style,   // `style=${x}`         → _style
    Event,   // `@evt=${x}`          → _event
    Prop,    // `:prop=${x}`         → _prop
    Model,   // `~model=${x}`        → _model
    OnModel, // `~onmodel=${x}`      → _onmodel
    Ref,     // `:ref=${x}`          → _ref
    List,    // `${repeat(...)}`     → _list
    Child,   // `${cond ? a : b}`    → _child
    Splice,  // `${nestedTemplate}`  → anchor.replaceWith(builder())
}

/// A classified hole: where, what, the binding name (attr/event/prop), and the
/// verbatim expression.
#[derive(Debug)]
pub struct Binding {
    pub path: NodePath,
    pub kind: BindingKind,
    pub name: Option<String>,
    pub expr: String,
}

/// Classify a parsed hole into a binding via (Slot × sigil × value-shape).
pub fn classify(hole: &Hole) -> Binding {
    let (kind, name) = match &hole.slot {
        Slot::Attr(name) => classify_attr(name),
        Slot::Content => (classify_content(&hole.expr), None),
    };
    Binding {
        path: hole.path.clone(),
        kind,
        name,
        expr: hole.expr.clone(),
    }
}

/// Attribute holes classify by the name's sigil (`@`/`:`/`~`) and reserved
/// names (`class`/`style`). The carried `name` is what the emitter passes to the
/// runtime primitive (event/prop/attr name); sigil-less kinds carry `None`.
fn classify_attr(name: &str) -> (BindingKind, Option<String>) {
    if let Some(event) = name.strip_prefix('@') {
        (BindingKind::Event, Some(event.to_string()))
    } else if name == ":ref" {
        (BindingKind::Ref, None)
    } else if let Some(prop) = name.strip_prefix(':') {
        (BindingKind::Prop, Some(prop.to_string()))
    } else if name == "~model" {
        (BindingKind::Model, None)
    } else if name == "~onmodel" {
        (BindingKind::OnModel, None)
    } else if name == "class" {
        (BindingKind::Class, None)
    } else if name == "style" {
        (BindingKind::Style, None)
    } else {
        (BindingKind::Attr, Some(name.to_string()))
    }
}

/// Content holes classify by the expression's value-shape:
///   * `repeat(...)`            → List
///   * `when(...)` / `choose(...)` or any `tpl`...`` subtemplate → Child
///   * anything else            → Text
///
/// `Splice` (a bare `tpl`` value reached through a variable or method, e.g.
/// `${header}` / `${this.headerTemplate()}`) is NOT detectable here — it is
/// syntactically identical to a text value and needs symbol resolution to know
/// the referent is a template. That wiring is deferred; such holes fall to Text
/// for now.
fn classify_content(expr: &str) -> BindingKind {
    match leading_call(expr) {
        Some("repeat") => return BindingKind::List,
        Some("when") | Some("choose") => return BindingKind::Child,
        _ => {}
    }
    if contains_html_template(expr) {
        BindingKind::Child
    } else {
        BindingKind::Text
    }
}

/// If `expr` is a call `ident(...)`, return the callee identifier. A bare
/// identifier (no call), a member expression, or a ternary returns `None`.
fn leading_call(expr: &str) -> Option<&str> {
    let t = expr.trim_start();
    let end = t.find(|c: char| !is_ident_char(c))?;
    if end == 0 {
        return None;
    }
    let rest = t[end..].trim_start();
    rest.starts_with('(').then(|| &t[..end])
}

/// Does `expr` contain a `` tpl`...` `` tagged template — i.e. `tpl` followed
/// by a backtick, not as the tail of a longer identifier (`mytpl``)?
fn contains_html_template(expr: &str) -> bool {
    let mut start = 0;
    while let Some(rel) = expr[start..].find("tpl`") {
        let at = start + rel;
        let prev_is_ident = expr[..at]
            .chars()
            .next_back()
            .map(is_ident_char)
            .unwrap_or(false);
        if !prev_is_ident {
            return true;
        }
        start = at + "tpl`".len();
    }
    false
}

fn is_ident_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '$'
}
