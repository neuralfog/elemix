pub mod ts;

pub use ts::TsEmitter;

use crate::template::node::NodePath;

pub trait Emitter {
    fn template_decl(&self, id: &str, markup: &str) -> String;
    fn template_el_decl(&self, id: &str, markup: &str) -> String;
    fn clone_root(&self, root: &str, tpl: &str) -> String;
    fn clone_el(&self, root: &str, tpl: &str) -> String;
    fn grab(&self, var: &str, parent: &str, path: &NodePath) -> String;
    fn text_anchor(&self, var: &str, anchor: &str) -> String;
    fn dyn_lens(&self, var: &str, el: &str) -> String;
    fn split_run(&self, var: &str, el: &str, run: usize, statics: &[usize], lens: &str) -> String;
    fn text(&self, var: &str, el: &str) -> String;
    fn comment_anchor(&self, var: &str, sibling: &str) -> String;
    fn ret(&self, root: &str, builder: bool, el: bool, multi_root: bool) -> String;
    fn pending(&self, note: &str) -> String;

    fn event(&self, node: &str, name: &str, handler: &str) -> String;
    fn model(&self, node: &str, expr: &str) -> String;
    fn onmodel(&self, node: &str, transform: &str) -> String;
    fn reference(&self, node: &str, target: &str) -> String;
    fn child(&self, anchor: &str, getter: &str) -> String;
    fn list(&self, anchor: &str, items: &str, key: &str, render: &str) -> String;

    fn bounds(&self, var: &str, parent: &str, before: usize, after: usize) -> String;

    fn span(&self, var: &str, parent: &str, lead: usize, ordinal: usize) -> String;

    fn reanchor(&self, var: &str, parent: &str, bounds: &str) -> String;

    fn seat(&self, var: &str, parent: &str, bounds: &str) -> String;

    fn child_resume(
        &self,
        anchor: &str,
        server: &str,
        root: &str,
        hydrate: &str,
        fresh: &str,
    ) -> String;

    fn set_text(&self, node: &str, expr: &str) -> String;
    fn set_attr(&self, node: &str, name: &str, expr: &str) -> String;
    fn set_text_direct(&self, node: &str, expr: &str) -> String;
    fn set_attr_direct(&self, node: &str, name: &str, expr: &str) -> String;
    fn set_class(&self, node: &str, initial: &str, expr: &str) -> String;
    fn set_style(&self, node: &str, expr: &str) -> String;
    fn set_prop(&self, node: &str, name: &str, expr: &str) -> String;
    fn local(&self, var: &str, expr: &str) -> String;
    fn bind_group(&self, writes: &[String]) -> String;
}
