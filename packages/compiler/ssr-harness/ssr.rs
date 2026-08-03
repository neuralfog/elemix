//! SSR slice-1 emit: the `$$__ssr(): string` method injected behind `--ssr`.
//!
//! Locks the server-render emit for a flat shadow component (DSD wrapper +
//! inline `<style data-ssr>` + text/attr holes) and a flat `#no-shadow` one
//! (bare markup, no template, no style), plus focused unit tests for the two
//! building blocks. The CSR snapshots (`snapshots.rs`) prove the default path is
//! untouched — these only assert the extra method.

use elemix_compiler::ssr::ssr_method;
use elemix_compiler::template::parse::{fmt_array, ssr_inner, Chunk};
use elemix_compiler::{compile_hydrate, compile_ssr};

/// A single static chunk - the inner rope for `ssr_method` framing tests that
/// don't care about hole serialization.
fn static_inner(html: &str) -> Vec<Chunk> {
    vec![Chunk::Static(html.to_string())]
}

/// The `$$__hydrate(root: Node) { … }` block from a `--hydrate` compile, or the
/// empty string if none — the client hydration slice of the output. Brace-balanced
/// from the method's opening `{` so the nested `$__effect(() => { … })` is kept.
fn hydrate_method_text(compiled: &str) -> String {
    let Some(start) = compiled.find("$$__hydrate(") else {
        return String::new();
    };
    let tail = &compiled[start..];
    let open = tail.find('{').expect("method has a body");
    let mut depth = 0usize;
    for (i, ch) in tail[open..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return tail[..open + i + 1].to_string();
                }
            }
            _ => {}
        }
    }
    tail.to_string()
}

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

/// Compile a fixture with `--ssr` and return its `$$__ssr()` method, asserting a
/// clean compile.
fn ssr_fixture_method(path: &str) -> String {
    let source = std::fs::read_to_string(path).expect("read fixture");
    let (compiled, diags) = compile_ssr(&source, false);
    assert!(
        diags.is_empty(),
        "unexpected diagnostics in {path}: {diags:?}"
    );
    ssr_method_text(&compiled)
}

#[test]
fn when_directive_lowers_to_ssr_string_builder() {
    // `when(cond, then, else)` -> `$__ssrWhen`, each branch's `tpl` serialized to
    // a string literal. Locks slice-3 directive SSR.
    let method = ssr_fixture_method("fixtures/WhenElseApp.ts");
    insta::assert_snapshot!("ssr_when_else", method);
}

#[test]
fn match_directive_lowers_both_arities() {
    // `match(value, key, cases)` (3-arg) and `match(value, cases)` (2-arg) both
    // -> `$__ssrMatch`; case callbacks return serialized strings.
    let method = ssr_fixture_method("fixtures/MatchApp.ts");
    insta::assert_snapshot!("ssr_match", method);
}

#[test]
fn repeat_of_components_lowers_to_ssr_repeat_and_ssr_child() {
    // `repeat` -> `$__ssrRepeat`; each row is a child COMPONENT, so it lowers
    // through `$__ssrChild` (props forwarded, `data-h` for self-hydration) inside
    // the row string. The key fn is passed through and ignored by the builder.
    let method = ssr_fixture_method("fixtures/CardListApp.ts");
    assert!(
        method.contains("$__ssrRepeat("),
        "repeat must lower to $__ssrRepeat: {method}"
    );
    assert!(
        method.contains("$__ssrChild('user-card'"),
        "a component through repeat must lower to $__ssrChild: {method}"
    );
    insta::assert_snapshot!("ssr_repeat_components", method);
}

#[test]
fn ternary_over_nested_tpl_serializes_both_branches() {
    // AppCard: `hasSlot('header') ? tpl`…` : ''` - the nested `tpl` (with a
    // `<slot>`) serializes to a string literal, the empty branch stays `''`.
    let method = ssr_fixture_method("fixtures/AppCard.ts");
    assert!(
        method.contains("<slot name=\"header\">"),
        "conditional nested tpl slot must be server-rendered: {method}"
    );
    assert!(
        !method.contains("$__clone"),
        "no CSR DOM builder must leak into SSR: {method}"
    );
    insta::assert_snapshot!("ssr_conditional_slots", method);
}

#[test]
fn minify_bakes_static_minified_css_into_the_style_block() {
    // `--minify` resolves `styles = css` back to its module-scope `const css` and
    // bakes the shrunk sheet into `<style data-ssr>` as static text - no dev
    // whitespace, no per-request `${css}` interpolation.
    let source = std::fs::read_to_string("fixtures/CounterApp.ts").expect("read fixture");
    let (compiled, diags) = compile_ssr(&source, true);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    let method = ssr_method_text(&compiled);
    assert!(
        method.contains("button:hover{background:var(--accent-hover);}"),
        "expected baked minified css, got: {method}"
    );
    assert!(
        !method.contains("${css}"),
        "minified style must be static, not a dynamic `${{css}}`: {method}"
    );
}

#[test]
fn flat_no_shadow_component_emits_bare_markup() {
    let source = std::fs::read_to_string("fixtures/NoShadowApp.ts").expect("read fixture");
    let (compiled, diags) = compile_ssr(&source, false);
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
    // a text content hole, and a `repeat` list content hole (SSR-lowered to
    // `$__ssrRepeat`, the row template serialized inline). `~model` keeps its
    // ref's `.value` as the `value` attribute (no hydrate flash); every other
    // sigil hole (`@`/`~onmodel`/`:`) is dropped server-side.
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
    let rope = fmt_array(&inner);
    assert!(
        rope.contains("$__ssrClass(this.tone)")
            && rope.contains("$__ssrStyle(this.box)")
            && rope.contains("$__ssrAttr('title', this.hint)")
            && rope.contains("$__ssrAttr('value', (this.value).value)"),
        "text/attr holes must survive: {rope}"
    );
    assert!(
        !rope.contains("this.click")
            && !rope.contains("this.onChange")
            && !rope.contains("this.data")
            && !rope.contains("this.el"),
        "client-only sigil holes must be dropped: {rope}"
    );
    insta::assert_snapshot!("ssr_inner_holes", rope);
}

#[test]
fn hydrate_binds_events_and_reactive_text_onto_server_nodes() {
    // The client hydration method for a counter: walk the server nodes by the same
    // paths the CSR `view()` uses, attach the `@click`, and bind the reactive text
    // onto the node after the `<!---->` marker via `$__hydrateText` - no clone, no
    // return, zero DOM created.
    let source = std::fs::read_to_string("fixtures/CounterApp.ts").expect("read fixture");
    let (compiled, diags) = compile_hydrate(&source);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    assert!(
        compiled.contains("from '@neuralfog/elemix/ssr-runtime/client'"),
        "hydrate helper must import from the separate client entry, not the CSR runtime"
    );
    insta::assert_snapshot!("hydrate_counter", hydrate_method_text(&compiled));
}

#[test]
fn hydrate_takes_over_a_when_via_reanchor_and_child() {
    // `when` becomes reactive on the client: `$__reanchor` carves the server
    // content out of the `.stage` parent and drops in an anchor, then the CSR
    // `$__child` builder drives it. The sibling toggle button's `@click` still
    // binds by a stable path (it doesn't cross the structural region).
    let source = std::fs::read_to_string("fixtures/WhenElseApp.ts").expect("read fixture");
    let (compiled, diags) = compile_hydrate(&source);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    let method = hydrate_method_text(&compiled);
    assert!(
        method.contains("$__reanchor(") && method.contains("$__child("),
        "when must hydrate via reanchor + child: {method}"
    );
    assert!(
        method.contains("$__event(") && method.contains("this.toggle"),
        "sibling toggle @click must still bind: {method}"
    );
    insta::assert_snapshot!("hydrate_when", method);
}

#[test]
fn hydrate_takes_over_a_repeat_via_reanchor_and_list() {
    // `repeat` of components becomes a reactive keyed list on the client:
    // `$__reanchor` + `$__list` with the full row builder (props + row `@click`s).
    let source = std::fs::read_to_string("fixtures/CardListApp.ts").expect("read fixture");
    let (compiled, diags) = compile_hydrate(&source);
    assert!(diags.is_empty(), "unexpected diagnostics: {diags:?}");
    let method = hydrate_method_text(&compiled);
    assert!(
        method.contains("$__reanchor(") && method.contains("$__list("),
        "repeat must hydrate via reanchor + list: {method}"
    );
    insta::assert_snapshot!("hydrate_repeat", method);
}

#[test]
fn ssr_inner_renders_nested_component_via_child_helper() {
    // A parent template embedding a child component. Its `:prop` holes become the
    // forwarded props object and the element is replaced by an `$__ssrChild` call
    // (which renders the child's own `$$__ssr()` inline) rather than inert markup.
    // Client-only holes (`:ref`, `@event`) are dropped.
    let statics = [
        "<div><user-card :name=".to_string(),
        " :role=".to_string(),
        " :ref=".to_string(),
        " @hover=".to_string(),
        " /></div>".to_string(),
    ];
    let holes = [
        "this.props.name".to_string(),
        "this.props.role".to_string(),
        "this.cardEl".to_string(),
        "this.onHover".to_string(),
    ];
    let inner = ssr_inner(&statics, &holes);
    let rope = fmt_array(&inner);
    assert!(
        rope.contains(
            "$__ssrChild('user-card', {name: (this.props.name), role: (this.props.role)})"
        ),
        "nested component must lower to $__ssrChild: {rope}"
    );
    assert!(
        !rope.contains("this.cardEl") && !rope.contains("this.onHover"),
        "client-only holes must be dropped: {rope}"
    );
    insta::assert_snapshot!("ssr_inner_child", rope);
}

#[test]
fn ssr_inner_renders_propless_nested_component() {
    let statics = ["<user-card />".to_string()];
    let holes: [String; 0] = [];
    let inner = ssr_inner(&statics, &holes);
    insta::assert_snapshot!("ssr_inner_propless_child", fmt_array(&inner));
}

#[test]
fn ssr_method_shadow_wraps_with_style() {
    let method = ssr_method(
        "my-tag",
        Some("${css}"),
        false,
        false,
        "",
        static_inner("<b>x</b>"),
    );
    insta::assert_snapshot!("ssr_method_shadow_style", method);
}

#[test]
fn ssr_method_shadow_without_css_has_no_style() {
    let method = ssr_method("my-tag", None, false, false, "", static_inner("<b>x</b>"));
    insta::assert_snapshot!("ssr_method_shadow_no_css", method);
}

#[test]
fn ssr_method_no_shadow_is_bare() {
    let method = ssr_method(
        "my-tag",
        Some("${css}"),
        true,
        false,
        "",
        static_inner("<b>x</b>"),
    );
    insta::assert_snapshot!("ssr_method_no_shadow", method);
}

#[test]
fn ssr_method_emits_prelude_before_return() {
    let method = ssr_method(
        "my-tag",
        None,
        true,
        false,
        "const { x } = this;",
        static_inner("<b>x</b>"),
    );
    insta::assert_snapshot!("ssr_method_prelude", method);
}
