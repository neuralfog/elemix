//! Raw-TypeScript emitter — formats `Emitter` calls into source targeting
//! `@neuralfog/elemix/runtime`. Validated against the golden `view()`s.
//!
//! The `() => (...)` thunk that makes a value reactive is added here, in one
//! place, for every value binding (text/attr/class/style/prop/model/child/list).
//! Function/ref bindings (event/onmodel/ref) take their expression raw. The
//! parens also guard against the object-literal arrow-body gotcha.

use super::Emitter;
use crate::template::node::{NodePath, Step};

#[derive(Default)]
pub struct TsEmitter;

impl TsEmitter {
    pub fn new() -> Self {
        Self
    }
}

impl Emitter for TsEmitter {
    fn template_decl(&self, id: &str, markup: &str) -> String {
        format!("const {id} = template({});", js_string(markup))
    }

    fn template_el_decl(&self, id: &str, markup: &str) -> String {
        format!("const {id} = templateEl({});", js_string(markup))
    }

    fn clone_root(&self, root: &str, tpl: &str) -> String {
        format!("const {root} = clone({tpl});")
    }

    fn clone_el(&self, root: &str, tpl: &str) -> String {
        format!("const {root} = cloneEl({tpl});")
    }

    fn grab(&self, var: &str, parent: &str, path: &NodePath) -> String {
        format!("const {var} = {parent}{};", accessor(path))
    }

    fn text_anchor(&self, var: &str, anchor: &str) -> String {
        format!("const {var} = document.createTextNode('');\n{anchor}.replaceWith({var});")
    }

    fn comment_anchor(&self, var: &str, sibling: &str) -> String {
        format!("const {var} = document.createComment('');\n{sibling}.before({var});")
    }

    fn ret(&self, root: &str, builder: bool, el: bool, multi_root: bool) -> String {
        if builder && !el && !multi_root {
            format!("return {root}.firstChild!;")
        } else {
            format!("return {root};")
        }
    }

    fn pending(&self, note: &str) -> String {
        format!("// TODO[ec]: {note}")
    }

    fn event(&self, node: &str, name: &str, handler: &str) -> String {
        format!("_event({node}, '{name}', {handler});")
    }

    fn model(&self, node: &str, expr: &str) -> String {
        format!("_model({node} as HTMLInputElement, () => ({expr}));")
    }

    fn onmodel(&self, node: &str, transform: &str) -> String {
        format!("_onmodel({node} as HTMLInputElement, {transform});")
    }

    fn reference(&self, node: &str, target: &str) -> String {
        format!("_ref({node}, {target});")
    }

    fn child(&self, anchor: &str, getter: &str) -> String {
        format!("_child({anchor}, () => ({getter}));")
    }

    fn list(&self, anchor: &str, items: &str, key: &str, render: &str) -> String {
        format!("_list({anchor}, () => ({items}), {key}, {render});")
    }

    fn set_text(&self, node: &str, expr: &str) -> String {
        format!("_setText({node}, ({expr}));")
    }

    fn set_text_direct(&self, node: &str, expr: &str) -> String {
        format!("{node}.data = ({expr});")
    }

    fn set_attr_direct(&self, node: &str, name: &str, expr: &str) -> String {
        format!("{node}.setAttribute('{name}', ({expr}));")
    }

    fn set_attr(&self, node: &str, name: &str, expr: &str) -> String {
        format!("_setAttr({node}, '{name}', ({expr}));")
    }

    fn set_class(&self, node: &str, initial: &str, expr: &str) -> String {
        format!("_setClass({node}, {initial}, ({expr}));")
    }

    fn set_style(&self, node: &str, expr: &str) -> String {
        format!("_setStyle({node} as HTMLElement, ({expr}));")
    }

    fn set_prop(&self, node: &str, name: &str, expr: &str) -> String {
        format!("_setProp({node}, '{name}', ({expr}));")
    }

    fn local(&self, var: &str, expr: &str) -> String {
        format!("const {var} = ({expr});")
    }

    fn bind_group(&self, writes: &[String]) -> String {
        format!("effect(() => {{\n{}\n}});", writes.join("\n"))
    }
}

/// Render a path as TS member accesses using direct-pointer navigation. Every
/// step is node-indexed, so `firstChild`/`nextSibling` (raw pointer slots) reach
/// the target — cheaper than `firstElementChild`/`nextElementSibling`, whose
/// element-filtering is wasted work on the compiler's whitespace-tight markup.
/// `!` asserts the node exists (the path is derived from the known template shape).
fn accessor(path: &NodePath) -> String {
    let mut s = String::new();
    for step in path {
        match step {
            Step::Child(i) | Step::ChildNode(i) => {
                s.push_str(".firstChild!");
                for _ in 0..*i {
                    s.push_str(".nextSibling!");
                }
            }
            Step::FirstChild => s.push_str(".firstChild!"),
        }
    }
    s
}

/// Quote a string as a single-quoted TS string literal.
fn js_string(s: &str) -> String {
    let mut out = String::from("'");
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            _ => out.push(c),
        }
    }
    out.push('\'');
    out
}
