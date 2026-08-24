use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn compile(source: &str) -> String {
    crate::compile(source)
}

#[wasm_bindgen]
pub fn compile_ssr(source: &str) -> String {
    crate::compile_ssr(source, false).0
}

#[wasm_bindgen]
pub fn compile_hydrate(source: &str) -> String {
    crate::compile_hydrate(source, false).0
}
