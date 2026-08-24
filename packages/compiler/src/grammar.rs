use crate::template::node::{Hole, NodePath, Slot};

#[derive(Debug, Clone, PartialEq)]
pub enum BindingKind {
    Text,
    Attr,
    Class,
    Style,
    Event,
    Prop,
    Model,
    OnModel,
    Ref,
    List,
    Child,
    Splice,
}

#[derive(Debug)]
pub struct Binding {
    pub path: NodePath,
    pub kind: BindingKind,
    pub name: Option<String>,
    pub expr: String,
    pub baked: bool,
    pub span: oxc_span::Span,
    pub tag: Option<String>,
}

pub fn classify(hole: &Hole) -> Binding {
    let (kind, name, baked) = match &hole.slot {
        Slot::Attr(name) => {
            let (kind, name) = classify_attr(name);
            (kind, name, false)
        }
        Slot::Content => (classify_content(&hole.expr), None, false),
        Slot::Text => (BindingKind::Text, None, true),
    };
    Binding {
        path: hole.path.clone(),
        kind,
        name,
        expr: hole.expr.clone(),
        baked,
        span: hole.span,
        tag: hole.tag.clone(),
    }
}

pub(crate) fn is_text_content(expr: &str) -> bool {
    matches!(classify_content(expr), BindingKind::Text)
}

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

fn classify_content(expr: &str) -> BindingKind {
    match leading_call(expr) {
        Some("repeat") => return BindingKind::List,
        Some("when" | "choose" | "match") => return BindingKind::Child,
        _ => {}
    }
    if contains_html_template(expr) {
        BindingKind::Child
    } else {
        BindingKind::Text
    }
}

fn leading_call(expr: &str) -> Option<&str> {
    let t = expr.trim_start();
    let end = t.find(|c: char| !is_ident_char(c))?;
    if end == 0 {
        return None;
    }
    let rest = t[end..].trim_start();
    rest.starts_with('(').then(|| &t[..end])
}

fn contains_html_template(expr: &str) -> bool {
    let mut start = 0;
    while let Some(rel) = expr[start..].find("tpl`") {
        let at = start + rel;
        let prev_is_ident = expr[..at].chars().next_back().is_some_and(is_ident_char);
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
