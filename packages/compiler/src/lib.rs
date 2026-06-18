//! elemix compiler — a transform that lowers `` tpl`...` `` templates into
//! compiled `view()` methods targeting `@neuralfog/elemix/runtime`.
//!
//! Pipeline: locate → parse → classify → codegen → rewrite. See ARCHITECTURE.md.

pub mod codegen;
pub mod diagnostics;
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

pub use diagnostics::Diagnostic;
#[cfg(feature = "cli")]
pub use locate::collect_ts_files;
pub use locate::{find_html_templates, FoundTemplate};

/// Compile one source file: inline helper templates (Splice), expand `#`-pragma
/// blocks (component registration + styles), then rewrite the `template` member
/// into a compiled `view()`, hoisting the `template(...)` consts and wiring the
/// runtime import.
///
/// Any diagnostics are inlined into the output — errors as a module-scope
/// `throw`, warnings as `console.warn` — so the compiler never panics and the
/// in-browser playground stays alive (it compiles per keystroke). Callers that
/// want to fail the build instead use [`compile_diagnostics`].
pub fn compile(source: &str) -> String {
    compile_diagnostics(source).0
}

/// Like [`compile`], but also returns the diagnostics it inlined so a build
/// front-end can report them (and fail fast on errors).
pub fn compile_diagnostics(source: &str) -> (String, Vec<Diagnostic>) {
    let spliced = splice::inline_helpers(source);
    let diags = pragma::diagnose::collect(&spliced);
    // Best-effort transform: a pragma error makes `expand` bail, so the
    // pragmas pass through unexpanded — the inlined `throw` is what surfaces it.
    let expanded = pragma::expand(&spliced).unwrap_or(spliced);
    let compiled = imports::merge_runtime_imports(&rewrite::rewrite(&expanded));
    let out = diagnostics::inline(&compiled, &diags);
    (out, diags)
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
