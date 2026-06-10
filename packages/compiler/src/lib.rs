//! elemix compiler — a transform that lowers `` tpl`...` `` templates into
//! compiled `view()` methods targeting `@neuralfog/elemix/runtime`.
//!
//! Pipeline: locate → parse → classify → codegen → rewrite. See ARCHITECTURE.md.

pub mod codegen;
pub mod emit;
pub mod grammar;
mod locate;
pub mod lower;
pub mod rewrite;
pub mod splice;
pub mod template;

pub use locate::{collect_ts_files, find_html_templates, FoundTemplate};

/// Compile one source file: inline helper templates (Splice), then rewrite the
/// `template` member into a compiled `view()`, hoisting the `template(...)`
/// consts and wiring the runtime import.
pub fn compile(source: &str) -> String {
    rewrite::rewrite(&splice::inline_helpers(source))
}
