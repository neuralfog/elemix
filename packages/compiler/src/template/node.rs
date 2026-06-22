//! Node tree types + path addressing for `clone()`-then-grab codegen.

use oxc_span::Span;

/// One step from a parent toward a binding-bearing child node. Rendered by the
/// emitter as `.children[i]` / `.childNodes[i]` / `.firstChild`.
#[derive(Debug, Clone, PartialEq)]
pub enum Step {
    /// `.children[i]` — element children only.
    Child(usize),
    /// `.childNodes[i]` — includes text/comment anchors.
    ChildNode(usize),
    /// `.firstChild`.
    FirstChild,
}

/// A path from the cloned template root to a node, e.g. `[Child(1), Child(0)]`.
pub type NodePath = Vec<Step>;

/// Where a hole sits in the template — decided during HTML parsing purely by
/// position. The parser stays structural; the grammar later splits a `Content`
/// hole into Text/List/Child/Splice by inspecting the expression's value-shape.
#[derive(Debug, Clone, PartialEq)]
pub enum Slot {
    /// Inside an attribute value: `name=${x}` (name carries any sigil `@`/`:`/`~`).
    Attr(String),
    /// An element-content hole, addressed by a `<!---->` anchor in the markup.
    Content,
    /// A plain text hole that is the sole child of its element: the markup bakes a
    /// real text node, grabbed and written directly — no comment anchor, no
    /// `createTextNode`/`replaceWith` at render time.
    Text,
}

/// A located hole after parsing: how to reach its node, where it sits, and the
/// verbatim source of the `${...}` expression.
#[derive(Debug)]
pub struct Hole {
    pub path: NodePath,
    pub slot: Slot,
    pub expr: String,
    /// Absolute byte span of the `${...}` expression in the ORIGINAL source. The
    /// compile path doesn't need this (it works on the expr string), so it's
    /// [`Span::default`] there; the analyzer feeds real oxc spans via
    /// [`super::parse::parse_spanned`] to caret prop errors at the exact hole.
    pub span: Span,
    /// For an `Slot::Attr` hole, the tag of the element bearing it (e.g.
    /// `user-card`) — the analyzer needs it to resolve `<tag>` back to its class.
    /// `None` for content/text holes.
    pub tag: Option<String>,
}
