//! SSR slice-1 emit: the `$$__ssr(): string` method injected behind `--ssr`.
//!
//! Locks the server-render emit for a flat shadow component (DSD wrapper +
//! inline `<style data-ssr>` + text/attr holes) and a flat `#no-shadow` one
//! (bare markup, no template, no style), plus focused unit tests for the two
//! building blocks. The CSR snapshots (`snapshots.rs`) prove the default path is
//! untouched — these only assert the extra method.

use elemix_compiler::compile_ssr;
use elemix_compiler::ssr::ssr_method;
use elemix_compiler::template::parse::ssr_inner;

/// The `$$__ssr(): string { … }` block spliced into a compiled component, or the
/// empty string if none — the SSR-specific slice of the output.
fn ssr_method_text(compiled: &str) -> String {
    let Some(start) = compiled.find("$$__ssr()") else {
        return String::new();
    };
    let tail = &compiled[start..];
    // The method is `$$__ssr(): string {\n…\n}`; take through the first
    // line-leading `}` that closes it.
    let end = tail.find("\n}").map(|i| i + 2).unwrap_or(tail.len());
    tail[..end].to_string()
}

#[test]
fn flat_shadow_component_emits_dsd_and_style() {
    let source =
        std::fs::read_to_string("ssr-tests/fixtures/SsrButtonApp.ts").expect("read fixture");
    let (compiled, diags) = compile_ssr(&source);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    insta::assert_snapshot!("ssr_shadow_button", ssr_method_text(&compiled));
}

#[test]
fn flat_no_shadow_component_emits_bare_markup() {
    let source = std::fs::read_to_string("tests/fixtures/NoShadowApp.ts").expect("read fixture");
    let (compiled, diags) = compile_ssr(&source);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    let method = ssr_method_text(&compiled);
    assert!(
        !method.contains("<template shadowrootmode"),
        "no-shadow must not wrap in DSD: {method}"
    );
    assert!(
        !method.contains("<style data-ssr>"),
        "no-shadow must not inline a style: {method}"
    );
    insta::assert_snapshot!("ssr_no_shadow", method);
}

#[test]
fn ssr_inner_drops_client_holes_and_keeps_text_attr() {
    // A button with class/style/attr holes + event/model/onmodel/prop/ref holes,
    // a text content hole, and a list content hole routed to the stub.
    let statics = [
        "<button class=".to_string(),
        " style=".to_string(),
        " title=".to_string(),
        " @click=".to_string(),
        " ~model=".to_string(),
        " ~onmodel=".to_string(),
        " :prop=".to_string(),
        " :ref=".to_string(),
        ">".to_string(),
        "</button><ul>".to_string(),
        "</ul>".to_string(),
    ];
    let holes = [
        "this.tone".to_string(),
        "this.box".to_string(),
        "this.hint".to_string(),
        "this.click".to_string(),
        "this.value".to_string(),
        "this.onChange".to_string(),
        "this.data".to_string(),
        "this.el".to_string(),
        "this.label".to_string(),
        "repeat(this.items, (i) => tpl`<li></li>`)".to_string(),
    ];
    let inner = ssr_inner(&statics, &holes);
    assert_eq!(
        inner,
        "<button class=\"${$__ssrAttr(this.tone)}\" style=\"${$__ssrAttr(this.box)}\" \
         title=\"${$__ssrAttr(this.hint)}\">${$__ssrText(this.label)}</button>\
         <ul>${$__ssrSlot(repeat(this.items, (i) => tpl`<li></li>`))}</ul>"
    );
}

#[test]
fn ssr_method_shadow_wraps_with_style() {
    let method = ssr_method(
        "my-tag",
        Some("css"),
        false,
        "",
        "<b>${$__ssrText(this.x)}</b>",
    );
    assert_eq!(
        method,
        "$$__ssr(): string {\nreturn `<my-tag>\
         <template shadowrootmode=\"open\" shadowrootserializable=\"\">\
         <style data-ssr>${css}</style>\
         <b>${$__ssrText(this.x)}</b></template></my-tag>`;\n}"
    );
}

#[test]
fn ssr_method_shadow_without_css_has_no_style() {
    let method = ssr_method("my-tag", None, false, "", "<b>x</b>");
    assert_eq!(
        method,
        "$$__ssr(): string {\nreturn `<my-tag>\
         <template shadowrootmode=\"open\" shadowrootserializable=\"\">\
         <b>x</b></template></my-tag>`;\n}"
    );
}

#[test]
fn ssr_method_no_shadow_is_bare() {
    let method = ssr_method("my-tag", Some("css"), true, "", "<b>x</b>");
    assert_eq!(
        method,
        "$$__ssr(): string {\nreturn `<my-tag><b>x</b></my-tag>`;\n}"
    );
}

#[test]
fn ssr_method_emits_prelude_before_return() {
    let method = ssr_method("my-tag", None, true, "const { x } = this;", "<b>${x}</b>");
    assert_eq!(
        method,
        "$$__ssr(): string {\nconst { x } = this;\nreturn `<my-tag><b>${x}</b></my-tag>`;\n}"
    );
}
