//! elemix compiler — a transform that lowers `` tpl`...` `` templates into
//! compiled `view()` methods targeting `@neuralfog/elemix/runtime`.
//!
//! Pipeline: locate → parse → classify → codegen → rewrite. See ARCHITECTURE.md.

pub mod codegen;
pub mod emit;
pub mod grammar;
pub mod imports;
mod locate;
pub mod lower;
pub mod pragma;
pub mod rewrite;
#[cfg(feature = "cli")]
pub mod sourcemap;
pub mod splice;
pub mod template;
#[cfg(feature = "wasm")]
pub mod wasm;

#[cfg(feature = "cli")]
pub use locate::collect_ts_files;
pub use locate::{find_html_templates, FoundTemplate};

/// Compile one source file: inline helper templates (Splice), expand `#`-pragma
/// blocks (component registration + styles), then rewrite the `template` member
/// into a compiled `view()`, hoisting the `template(...)` consts and wiring the
/// runtime import.
///
/// Pragma errors are surfaced as a leading comment rather than a panic — the
/// compiler must stay alive for the in-browser playground (half-typed garbage
/// passes through untouched).
pub fn compile(source: &str) -> String {
    let spliced = splice::inline_helpers(source);
    let expanded = match pragma::expand(&spliced) {
        Ok(out) => out,
        Err(e) => format!("// [ec] pragma error: {e}\n{spliced}"),
    };
    imports::merge_runtime_imports(&rewrite::rewrite(&expanded))
}

/// Compile + a line-level source map back to the original (`cli` feature).
///
/// `compile` is splice-based, so user code survives verbatim and only shifts;
/// the map recovers each preserved line's origin by diffing original vs. output.
/// Returns `(compiled, source_map_json)`. `source_name` seeds `sources`/`file`
/// (callers that know the real path overwrite `sources[0]`).
#[cfg(feature = "cli")]
pub fn compile_with_map(source: &str, source_name: &str) -> (String, String) {
    let code = compile(source);
    let map = sourcemap::line_map(source, &code, source_name);
    (code, map)
}
