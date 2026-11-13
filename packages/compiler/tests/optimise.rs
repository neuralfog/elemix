use elemix_compiler::compile_ssr;
use elemix_compiler::optimise::{collect_meta, optimise};

const CHILD_CALL: &str = "$__ssrChild('icon-button'";
const CHILD_BODY_MARKER: &str = "display: inline-flex";

fn compiled_ssr(name: &str) -> String {
    let path = format!("{}/fixtures/{}", env!("CARGO_MANIFEST_DIR"), name);
    let source = std::fs::read_to_string(&path).expect("read fixture");
    compile_ssr(&source, false).0
}

#[test]
fn clean_child_is_inlined_and_body_preserved() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    assert!(compiled.contains(CHILD_CALL));

    let registry = collect_meta(&compiled);
    let (optimised, inlined) = optimise(&compiled, &registry);

    assert_eq!(inlined, 1);
    assert!(!optimised.contains(CHILD_CALL));
    assert!(optimised.contains(CHILD_BODY_MARKER));
}

#[test]
fn leaf_child_is_marked_simple() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let registry = collect_meta(&compiled);
    let child = registry
        .iter()
        .find(|m| m.tag == "icon-button")
        .expect("icon-button meta");
    assert!(child.simple);
}

#[test]
fn stateful_root_component_is_not_simple() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let registry = collect_meta(&compiled);
    let app = registry
        .iter()
        .find(|m| m.tag == "icon-button-app")
        .expect("icon-button-app meta");
    assert!(!app.simple);
}

#[test]
fn empty_registry_is_a_noop() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let (optimised, inlined) = optimise(&compiled, &[]);
    assert_eq!(inlined, 0);
    assert_eq!(optimised, compiled);
}

#[test]
fn unknown_tag_is_not_inlined() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let mut registry = collect_meta(&compiled);
    for m in &mut registry {
        m.tag = format!("other-{}", m.tag);
    }
    let (optimised, inlined) = optimise(&compiled, &registry);
    assert_eq!(inlined, 0);
    assert!(optimised.contains(CHILD_CALL));
}

#[test]
fn non_simple_child_is_not_inlined() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let mut registry = collect_meta(&compiled);
    for m in &mut registry {
        if m.tag == "icon-button" {
            m.simple = false;
        }
    }
    let (optimised, inlined) = optimise(&compiled, &registry);
    assert_eq!(inlined, 0);
    assert!(optimised.contains(CHILD_CALL));
}

#[test]
fn prop_values_are_substituted_into_inlined_body() {
    let parent = compiled_ssr("PropsApp.ts");
    assert!(parent.contains("$__ssrChild('props-child'"));

    let registry = collect_meta(&compiled_ssr("PropsChild.ts"));
    let (optimised, inlined) = optimise(&parent, &registry);

    assert_eq!(inlined, 1);
    assert!(!optimised.contains("$__ssrChild('props-child'"));
    assert!(optimised.contains("class=\"label\""));
    assert!(optimised.matches("hello").count() >= 2);
}

#[test]
fn slot_content_is_inlined() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let registry = collect_meta(&compiled);
    let (optimised, inlined) = optimise(&compiled, &registry);
    assert_eq!(inlined, 1);
    assert!(optimised.contains("class=\"pip\""));
    assert!(optimised.contains('★'));
}

#[test]
fn helper_imports_are_present_after_inlining() {
    let compiled = compiled_ssr("IconButtonApp.ts");
    let registry = collect_meta(&compiled);
    let (optimised, inlined) = optimise(&compiled, &registry);
    assert_eq!(inlined, 1);
    assert!(optimised.contains("from '@neuralfog/elemix/ssr-runtime'"));
}

#[test]
fn too_few_args_is_not_inlined() {
    let registry = collect_meta(&compiled_ssr("PropsChild.ts"));
    let call = "$__ssrChild('props-child')";
    let (optimised, inlined) = optimise(call, &registry);
    assert_eq!(inlined, 0);
    assert!(optimised.contains(call));
}

#[test]
fn too_many_args_is_not_inlined() {
    let registry = collect_meta(&compiled_ssr("PropsChild.ts"));
    let call = "$__ssrChild('props-child', a, b, c, d, e)";
    let (optimised, inlined) = optimise(call, &registry);
    assert_eq!(inlined, 0);
    assert!(optimised.contains(call));
}

#[test]
fn strips_ssr_tpl_wrapper() {
    let (optimised, inlined) = optimise("const _r = $__ssrTpl(`<p>hi</p>`);", &[]);
    assert_eq!(inlined, 0);
    assert!(!optimised.contains("$__ssrTpl("));
    assert!(optimised.contains("`<p>hi</p>`"));
}

#[test]
fn strips_multi_arg_ssr_tpl_to_array() {
    let (optimised, _) = optimise("const _r = $__ssrTpl(`<li>`, x, `</li>`);", &[]);
    assert!(!optimised.contains("$__ssrTpl("));
    assert!(optimised.contains("[`<li>`, x, `</li>`]"));
}

#[test]
fn strips_nested_ssr_tpl_via_fixpoint() {
    let (optimised, _) = optimise(
        "const _r = $__ssrTpl(`<ul>`, $__ssrTpl(`<li>`, y), `</ul>`);",
        &[],
    );
    assert!(!optimised.contains("$__ssrTpl("));
    assert!(optimised.contains("[`<ul>`, [`<li>`, y], `</ul>`]"));
}

#[test]
fn folds_ssr_text_literal_and_escapes() {
    let (optimised, _) = optimise("const _r = $__ssrText('a<b');", &[]);
    assert!(!optimised.contains("$__ssrText("));
    assert!(optimised.contains("\"a&lt;b\""));
}

#[test]
fn folds_ssr_len_to_utf16_length() {
    let (optimised, _) = optimise("const _r = $__ssrLen('abcd');", &[]);
    assert!(!optimised.contains("$__ssrLen("));
    assert!(optimised.contains("= 4;"));
}

#[test]
fn drops_dead_const_temp() {
    let (optimised, _) = optimise("const _t0 = ('x');\nconst _r0 = (1);", &[]);
    assert!(!optimised.contains("_t0"));
    assert!(optimised.contains("_r0"));
}

#[test]
fn collapses_iife_to_return_expression() {
    let (optimised, _) = optimise("const _r = (() => { return `x`; })();", &[]);
    assert!(!optimised.contains("=>"));
    assert!(optimised.contains("`x`"));
}

#[test]
fn flattens_nested_template_hole() {
    let (optimised, _) = optimise("const _r = `a${`b`}c`;", &[]);
    assert!(optimised.contains("`abc`"));
    assert!(!optimised.contains("${"));
}
