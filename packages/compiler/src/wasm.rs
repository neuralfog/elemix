//! WebAssembly entry point — exposes `compile()` to JS for the in-browser
//! playground. Built via `wasm-pack --features wasm`; the CLI/fs surface
//! (`collect_ts_files`, the bin) is feature-gated out and never crosses over.

use wasm_bindgen::prelude::wasm_bindgen;

/// Surface panics as catchable JS errors instead of an unrecoverable wasm abort
/// — the playground feeds half-typed input on every keystroke. Runs on init.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Compile one source string of elemix components into its compiled `.ts` form.
#[wasm_bindgen]
pub fn compile(source: &str) -> String {
    crate::compile(source)
}
