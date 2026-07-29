//! SSR method synthesis — wrap a component's server-rendered inner HTML in its
//! host markup and emit the `$$__ssr(): string` method.
//!
//! The inner HTML comes from [`crate::template::parse::ssr_inner`]; this module
//! only frames it. A shadow component emits Declarative Shadow DOM (a
//! `<template shadowrootmode>` carrying an inline `<style data-ssr>` sheet); a
//! `#no-shadow` component emits bare host markup with no template and no style
//! (its CSS is document-level). The emitted method references the SSR-runtime
//! helpers (`$__ssrText`/`$__ssrAttr`/`$__ssrChild`/`$__ssrRepeat`/… — see
//! [`crate::imports::add_ssr_runtime_import`]) as free identifiers, imported from
//! `@neuralfog/elemix/ssr-runtime`, not the CSR runtime.

/// Build the `$$__ssr(): string` method text for one component.
///
/// `host_tag` is the registered custom-element tag; `style_body` is the verbatim
/// inner of the inline `<style data-ssr>` for shadow components — the caller
/// decides its shape: a dynamic `${css}` interpolation, or precompiled minified
/// CSS baked in as static text (see [`crate::ssr_style`]) — or `None` for no
/// style; `no_shadow` selects the light-DOM branch; `prelude` is the template's
/// block-body prelude (a leading destructure the holes reference), emitted
/// verbatim before the `return`; `inner` is the pre-built template-literal body.
pub fn ssr_method(
    host_tag: &str,
    style_body: Option<&str>,
    no_shadow: bool,
    client: bool,
    prelude: &str,
    inner: &str,
) -> String {
    // The host wrapper uses the instance's RUNTIME tag (`$$__tag`, stamped next to
    // `$__defineComponent`), not a baked literal - so a subclass inheriting this
    // `$$__ssr()` (its template lives on an ancestor) still renders with its OWN
    // registered tag. Falls back to the compile-time tag if unstamped.
    let tag = format!("${{this.$$__tag ?? '{host_tag}'}}");
    // `#client` — emit ONLY the bare host tag: no DSD, no content, no prelude. The
    // client has no server DOM to hydrate, so it mounts the CSR view fresh.
    if client {
        return format!("$$__ssr(): string {{\nreturn `<{tag}></{tag}>`;\n}}");
    }
    let wrapped = if no_shadow {
        format!("<{tag}>{inner}</{tag}>")
    } else {
        let style = match style_body {
            Some(body) => format!("<style data-ssr>{body}</style>"),
            None => String::new(),
        };
        format!(
            "<{tag}><template shadowrootmode=\"open\" shadowrootserializable=\"\">{style}{inner}</template></{tag}>"
        )
    };
    if prelude.is_empty() {
        format!("$$__ssr(): string {{\nreturn `{wrapped}`;\n}}")
    } else {
        format!("$$__ssr(): string {{\n{prelude}\nreturn `{wrapped}`;\n}}")
    }
}
