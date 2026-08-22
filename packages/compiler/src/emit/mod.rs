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
    /// `const <id> = templateEl('<markup>')` — single-root element master.
    fn template_el_decl(&self, id: &str, markup: &str) -> String;
    /// `const <root> = clone(<tpl>)`.
    fn clone_root(&self, root: &str, tpl: &str) -> String;
    /// `const <root> = cloneEl(<tpl>)` — clone the root element directly.
    fn clone_el(&self, root: &str, tpl: &str) -> String;
    /// `const <var> = <parent><path>` — reach a node by path.
    fn grab(&self, var: &str, parent: &str, path: &NodePath) -> String;
    /// Replace a content anchor with a fresh text node for `_text`; binds `var`.
    fn text_anchor(&self, var: &str, anchor: &str) -> String;
    /// `const <var> = $__dynLens(<el>)` — read and strip the element's `data-t`
    /// attribute (the rendered lengths of its dynamic text values), for hydration.
    fn dyn_lens(&self, var: &str, el: &str) -> String;
    /// `const <var> = $__splitRun(<el>.firstChild(.nextSibling×run), [<statics>], <lens>)`
    /// — split the element's markerless merged text run into its dynamic value nodes,
    /// using the compiled static prefixes and the runtime dynamic lengths. `run` is the
    /// run's server-DOM child index (nonzero when static element siblings precede it).
    fn split_run(&self, var: &str, el: &str, run: usize, statics: &[usize], lens: &str) -> String;
    /// `const <var> = $__text(<el>)` — the element's existing text-node child, or
    /// a freshly created empty one. A sole (baked) text hole that rendered EMPTY
    /// server-side leaves no text node; this gives hydration a node to bind onto
    /// so the first reactive write has somewhere to land.
    fn text(&self, var: &str, el: &str) -> String;
    /// Insert a fresh comment anchor before `sibling`; binds `var` (used to give
    /// a `repeat`-in-ternary its own `_list` anchor next to the `_child` one).
    fn comment_anchor(&self, var: &str, sibling: &str) -> String;
    /// `return <root>` (view, an element-cloned builder, or a multi-root child
    /// value) or `return <root>.firstChild!` (a fragment-cloned single-node row
    /// for `_list`, which tracks one node per key).
    fn ret(&self, root: &str, builder: bool, el: bool, multi_root: bool) -> String;
    /// A marker for a binding the codegen cannot yet lower.
    fn pending(&self, note: &str) -> String;

    fn event(&self, node: &str, name: &str, handler: &str) -> String;
    fn model(&self, node: &str, expr: &str) -> String;
    fn onmodel(&self, node: &str, transform: &str) -> String;
    fn reference(&self, node: &str, target: &str) -> String;
    fn child(&self, anchor: &str, getter: &str) -> String;
    fn list(&self, anchor: &str, items: &str, key: &str, render: &str) -> String;

    /// Capture a structural hole's server content region on the PRISTINE DOM
    /// (before any takeover mutates sibling counts): binds `var` to
    /// `[firstNode, count]` - the first content node and how many nodes the region
    /// spans. A node ref + count survive an earlier adjacent sibling's `reanchor`
    /// (which may insert/remove nodes to the LEFT), where live indices or a
    /// neighbouring-hole boundary ref would not. All `bounds` for a parent are
    /// emitted up front, before any `reanchor`.
    fn bounds(&self, var: &str, parent: &str, before: usize, after: usize) -> String;

    /// Like `bounds`, but for a parent with MULTIPLE structural regions, where a
    /// dynamic sibling's node count is unknown at compile time so static indices
    /// cannot delimit a region. Locates the region by the `<!---->` delimiter SSR
    /// emits after it: `ordinal` is the region's index among the parent's delimiters
    /// and `lead` the static nodes between the previous delimiter and this region.
    fn span(&self, var: &str, parent: &str, lead: usize, ordinal: usize) -> String;

    /// Hydration takeover: insert a fresh comment anchor before the region's first
    /// node (captured in `bounds`), remove that region's `count` server nodes, and
    /// bind the anchor to `var` - so the normal `child`/`list` builder can drive the
    /// region reactively, exactly as client-only would.
    fn reanchor(&self, var: &str, parent: &str, bounds: &str) -> String;

    /// Resume seat: keep the server region (captured in `bounds`) and drop a comment
    /// anchor AFTER it, binding `var` to `[anchor, serverRoot]` - the server root is
    /// adopted on the first run, the anchor drives fresh content on later changes.
    fn seat(&self, var: &str, parent: &str, bounds: &str) -> String;

    /// `$__child(anchor, $__resume(server, (root) => (hydrate), () => (fresh)))` -
    /// adopt + hydrate the server subtree at `root` on the first run (component
    /// self-hydrates, single mount), clone `fresh` on later reactive changes.
    fn child_resume(
        &self,
        anchor: &str,
        server: &str,
        root: &str,
        hydrate: &str,
        fresh: &str,
    ) -> String;

    // Grouped value writes: the per-binding write with no effect of its own. The
    // codegen collects these and wraps them in one `effect` per template instance
    // via `bind_group`, so a row costs one Scope/Set instead of one per binding.
    fn set_text(&self, node: &str, expr: &str) -> String;
    fn set_attr(&self, node: &str, name: &str, expr: &str) -> String;
    /// Set-once direct writes for static (key-field) bindings — no toText, no
    /// write-cache: the value is written once and never re-checked.
    fn set_text_direct(&self, node: &str, expr: &str) -> String;
    fn set_attr_direct(&self, node: &str, name: &str, expr: &str) -> String;
    fn set_class(&self, node: &str, initial: &str, expr: &str) -> String;
    fn set_style(&self, node: &str, expr: &str) -> String;
    fn set_prop(&self, node: &str, name: &str, expr: &str) -> String;
    /// `const <var> = (<expr>)` — a hoisted local for a common subexpression
    /// shared by grouped writes, so its signal is read/tracked once, not per use.
    fn local(&self, var: &str, expr: &str) -> String;
    /// Wrap the collected grouped writes in a single `effect(() => { ... })`.
    fn bind_group(&self, writes: &[String]) -> String;
}
