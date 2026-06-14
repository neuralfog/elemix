//! Stage 4 — the runtime interface the codegen targets.
//!
//! A stateless formatter: one method per runtime primitive, each returning the
//! TypeScript statement(s) for that call. The runtime API *is* this trait —
//! decoupling means a runtime API change touches one impl, not the codegen, and
//! the golden `view()`s become a conformance suite for the emitter. Variable
//! names and ordering are the codegen's job; this layer only formats.

pub mod ts;

pub use ts::TsEmitter;

use crate::template::node::NodePath;

pub trait Emitter {
    /// `const <id> = template('<markup>')` (module scope).
    fn template_decl(&self, id: &str, markup: &str) -> String;
    /// `const <root> = clone(<tpl>)`.
    fn clone_root(&self, root: &str, tpl: &str) -> String;
    /// `const <var> = <parent><path>` — reach a node by path.
    fn grab(&self, var: &str, parent: &str, path: &NodePath) -> String;
    /// Replace a content anchor with a fresh text node for `_text`; binds `var`.
    fn text_anchor(&self, var: &str, anchor: &str) -> String;
    /// Insert a fresh comment anchor before `sibling`; binds `var` (used to give
    /// a `repeat`-in-ternary its own `_list` anchor next to the `_child` one).
    fn comment_anchor(&self, var: &str, sibling: &str) -> String;
    /// `return <root>` (view) or `return <root>.firstChild!` (nested builder).
    fn ret(&self, root: &str, builder: bool) -> String;
    /// A marker for a binding the codegen cannot yet lower.
    fn pending(&self, note: &str) -> String;

    fn event(&self, node: &str, name: &str, handler: &str) -> String;
    fn model(&self, node: &str, expr: &str) -> String;
    fn onmodel(&self, node: &str, transform: &str) -> String;
    fn reference(&self, node: &str, target: &str) -> String;
    fn child(&self, anchor: &str, getter: &str) -> String;
    fn list(&self, anchor: &str, items: &str, key: &str, render: &str) -> String;

    // Grouped value writes: the per-binding write with no effect of its own. The
    // codegen collects these and wraps them in one `effect` per template instance
    // via `bind_group`, so a row costs one Scope/Set instead of one per binding.
    fn set_text(&self, node: &str, expr: &str) -> String;
    fn set_attr(&self, node: &str, name: &str, expr: &str) -> String;
    fn set_class(&self, node: &str, initial: &str, expr: &str) -> String;
    fn set_style(&self, node: &str, expr: &str) -> String;
    fn set_prop(&self, node: &str, name: &str, expr: &str) -> String;
    /// Wrap the collected grouped writes in a single `effect(() => { ... })`.
    fn bind_group(&self, writes: &[String]) -> String;
}
