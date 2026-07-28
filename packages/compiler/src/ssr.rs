//! SSR method synthesis (slice 1) — wrap a component's server-rendered inner
//! HTML in its host markup and emit the `$$__ssr(): string` method.
//!
//! The inner HTML comes from [`crate::template::parse::ssr_inner`]; this module
//! only frames it. A shadow component emits Declarative Shadow DOM (a
//! `<template shadowrootmode>` carrying an inline `<style data-ssr>` sheet); a
//! `#no-shadow` component emits bare host markup with no template and no style
//! (its CSS is document-level). The emitted method references the SSR-runtime
//! stubs `$__ssrText`/`$__ssrAttr`/`$__ssrSlot` as free identifiers — they are
//! not wired into the CSR runtime import (slice 1 does not implement them).

/// Build the `$$__ssr(): string` method text for one component.
///
/// `host_tag` is the registered custom-element tag; `css_value` is the stylesheet
/// initializer expression (e.g. the identifier `css`) interpolated into an inline
/// `<style data-ssr>` for shadow components, or `None` for none; `no_shadow`
/// selects the light-DOM branch; `prelude` is the template's block-body prelude
/// (a leading destructure the holes reference), emitted verbatim before the
/// `return`; `inner` is the pre-built template-literal body.
pub fn ssr_method(
    host_tag: &str,
    css_value: Option<&str>,
    no_shadow: bool,
    prelude: &str,
    inner: &str,
) -> String {
    let wrapped = if no_shadow {
        format!("<{host_tag}>{inner}</{host_tag}>")
    } else {
        let style = match css_value {
            Some(css) => format!("<style data-ssr>${{{css}}}</style>"),
            None => String::new(),
        };
        format!(
            "<{host_tag}><template shadowrootmode=\"open\" shadowrootserializable=\"\">{style}{inner}</template></{host_tag}>"
        )
    };
    if prelude.is_empty() {
        format!("$$__ssr(): string {{\nreturn `{wrapped}`;\n}}")
    } else {
        format!("$$__ssr(): string {{\n{prelude}\nreturn `{wrapped}`;\n}}")
    }
}
