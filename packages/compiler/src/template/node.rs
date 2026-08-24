use oxc_span::Span;

#[derive(Debug, Clone, PartialEq)]
pub enum Step {
    Child(usize),
    ChildNode(usize),
}

pub type NodePath = Vec<Step>;

#[derive(Debug, Clone, PartialEq)]
pub enum Slot {
    Attr(String),
    Content,
    Text,
}

#[derive(Debug)]
pub struct Hole {
    pub path: NodePath,
    pub slot: Slot,
    pub expr: String,
    pub span: Span,
    pub tag: Option<String>,
    pub prefix: usize,
    pub run_index: usize,
}
