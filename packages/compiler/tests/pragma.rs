//! Tests for the comment-based pragma layer — directive splitting from a `//`
//! pragma's text, next-line binding (class vs styles field), the resolve
//! extension point, tag derivation, and the full lowering.

use elemix_compiler::pragma::locate::{locate, LocateError};
use elemix_compiler::pragma::lower::{expand, ExpandError};
use elemix_compiler::pragma::parse::{is_pragma, split_directives};
use elemix_compiler::pragma::{kebab, resolve, ComponentMeta, Directive, PragmaError};

fn dir(name: &str, args: &[&str]) -> Directive {
    Directive {
        name: name.to_string(),
        args: args.iter().map(|s| s.to_string()).collect(),
    }
}

// --- parse --------------------------------------------------------------------

#[test]
fn splits_a_flag_directive() {
    assert_eq!(split_directives(" #component"), vec![dir("component", &[])]);
}

#[test]
fn splits_a_single_word_directive() {
    assert_eq!(
        split_directives(" #tag pf-builder"),
        vec![dir("tag", &["pf-builder"])]
    );
}

#[test]
fn splits_many_directives_on_one_line() {
    assert_eq!(
        split_directives(" #component #tag pf-builder #form"),
        vec![
            dir("component", &[]),
            dir("tag", &["pf-builder"]),
            dir("form", &[]),
        ]
    );
}

#[test]
fn is_pragma_detects_leading_hash() {
    assert!(is_pragma(" #component"));
    assert!(is_pragma("#styles"));
    assert!(!is_pragma(" hello"));
    assert!(!is_pragma(" a #b")); // `#` not the first non-ws char
    assert!(!is_pragma(""));
}

// --- resolve (the extension point) -------------------------------------------

#[test]
fn resolves_component_and_tag() {
    let dirs = vec![dir("component", &[]), dir("tag", &["pf-builder"])];
    assert_eq!(
        resolve(&dirs),
        Ok(ComponentMeta {
            register: true,
            tag: Some("pf-builder".to_string()),
            form: false,
        })
    );
}

#[test]
fn form_resolves_to_a_flag() {
    assert!(resolve(&[dir("form", &[])]).unwrap().form);
    assert!(!resolve(&[dir("component", &[])]).unwrap().form);
}

#[test]
fn styles_on_a_class_is_an_error() {
    // `#styles` belongs on a class field, not on the class itself.
    assert_eq!(
        resolve(&[dir("styles", &[])]),
        Err(PragmaError::OnClass("styles".to_string()))
    );
}

#[test]
fn unknown_directive_is_an_error() {
    assert_eq!(
        resolve(&[dir("stules", &[])]),
        Err(PragmaError::Unknown("stules".to_string()))
    );
}

#[test]
fn conflicting_tags_error() {
    let dirs = vec![dir("tag", &["a-b"]), dir("tag", &["c-d"])];
    assert_eq!(
        resolve(&dirs),
        Err(PragmaError::DuplicateTag(
            "a-b".to_string(),
            "c-d".to_string()
        ))
    );
}

#[test]
fn repeated_identical_tag_is_fine() {
    let dirs = vec![dir("tag", &["a-b"]), dir("tag", &["a-b"])];
    assert_eq!(resolve(&dirs).unwrap().tag, Some("a-b".to_string()));
}

#[test]
fn tag_needs_exactly_one_word() {
    assert_eq!(resolve(&[dir("tag", &[])]), Err(PragmaError::TagArity));
    assert_eq!(
        resolve(&[dir("tag", &["a", "b"])]),
        Err(PragmaError::TagArity)
    );
}

// --- kebab derivation --------------------------------------------------------

#[test]
fn kebab_pascal_case() {
    assert_eq!(kebab("PfBuilder"), "pf-builder");
    assert_eq!(kebab("PfBuilderButton"), "pf-builder-button");
}

#[test]
fn kebab_handles_acronyms() {
    assert_eq!(kebab("PfXMLBuilder"), "pf-xml-builder");
    assert_eq!(kebab("XMLParser"), "xml-parser");
}

#[test]
fn kebab_single_word_has_no_hyphen() {
    assert_eq!(kebab("Button"), "button");
}

// --- locate (comment detection + next-line binding) --------------------------

#[test]
fn binds_a_component_comment_to_its_class() {
    let loc = locate("// #component\nclass Foo extends Component {}").unwrap();
    assert_eq!(loc.classes.len(), 1);
    assert_eq!(loc.classes[0].name, "Foo");
    assert_eq!(loc.classes[0].directives, vec![dir("component", &[])]);
    assert!(loc.classes[0].styles.is_empty());
}

#[test]
fn binds_a_styles_comment_to_a_class_field() {
    let loc = locate(
        "// #component\nclass Foo extends Component {\n    // #styles\n    styles = css;\n}",
    )
    .unwrap();
    assert_eq!(loc.classes.len(), 1);
    assert_eq!(loc.classes[0].directives, vec![dir("component", &[])]);
    assert_eq!(loc.classes[0].styles.len(), 1);
    assert_eq!(loc.classes[0].styles[0].value, "css");
}

#[test]
fn a_non_styles_directive_on_a_field_errors() {
    assert_eq!(
        locate("class Foo extends Component {\n    // #tag x\n    y = 1;\n}"),
        Err(LocateError::OnField("tag".to_string()))
    );
}

#[test]
fn binds_to_an_exported_class() {
    let loc = locate("// #component\nexport class Widget extends Component {}").unwrap();
    assert_eq!(loc.classes[0].name, "Widget");
    assert_eq!(loc.classes[0].directives, vec![dir("component", &[])]);
}

#[test]
fn two_components_in_one_file() {
    let loc = locate(
        "// #component\nclass A extends Component {}\n// #component #tag b-tag\nclass B extends Component {}",
    )
    .unwrap();
    assert_eq!(loc.classes.len(), 2);
    let a = loc.classes.iter().find(|c| c.name == "A").unwrap();
    let b = loc.classes.iter().find(|c| c.name == "B").unwrap();
    assert_eq!(a.directives, vec![dir("component", &[])]);
    assert_eq!(
        b.directives,
        vec![dir("component", &[]), dir("tag", &["b-tag"])]
    );
}

#[test]
fn classes_without_a_pragma_carry_no_directives() {
    let loc = locate("class Plain extends Component {}").unwrap();
    assert_eq!(loc.classes.len(), 1);
    assert!(loc.classes[0].directives.is_empty());
    assert!(loc.classes[0].styles.is_empty());
}

#[test]
fn non_pragma_comments_are_ignored() {
    let loc = locate("// just a note\nclass Foo extends Component {}").unwrap();
    assert!(loc.classes[0].directives.is_empty());
}

#[test]
fn a_blank_line_breaks_the_binding() {
    assert_eq!(
        locate("// #component\n\nclass Foo extends Component {}"),
        Err(LocateError::Orphan)
    );
}

#[test]
fn pragma_with_nothing_after_is_orphan() {
    assert_eq!(locate("// #component"), Err(LocateError::Orphan));
}

#[test]
fn a_class_directive_on_a_const_errors() {
    assert_eq!(
        locate("// #component\nconst x = 1;"),
        Err(LocateError::OnConst("component".to_string()))
    );
}

#[test]
fn imports_before_a_pragma_are_fine() {
    let loc = locate(
        "import { Component } from '@neuralfog/elemix';\n// #component\nclass Foo extends Component {}",
    )
    .unwrap();
    assert_eq!(loc.classes[0].name, "Foo");
    assert_eq!(loc.classes[0].directives, vec![dir("component", &[])]);
}

// --- expand (lowering) -------------------------------------------------------

#[test]
fn lowers_a_full_component() {
    let src = "const css = `c`;\n// #component\nclass Foo extends Component {\n    // #styles\n    styles = css;\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("import { defineComponent, sheet } from '@neuralfog/elemix/runtime';"));
    assert!(out.contains("const css = `c`;")); // the referenced const stays in place
    assert!(out.contains("const _s0 = sheet(css);")); // field value inlined by name
    assert!(out.contains("Foo.__sheets = [..._s0];"));
    assert!(out.contains("defineComponent('foo', Foo);"));
    assert!(!out.contains("styles = css")); // the styles field is stripped
    assert!(!out.contains("// #styles"));
    assert!(!out.contains("// #component"));
}

#[test]
fn explicit_tag_overrides_derivation() {
    let out = expand("// #component #tag my-thing\nclass Foo extends Component {}").unwrap();
    assert!(out.contains("defineComponent('my-thing', Foo);"));
    assert!(!out.contains("'foo'"));
}

#[test]
fn derives_tag_from_class_name() {
    let out = expand("// #component\nclass PfBuilderButton extends Component {}").unwrap();
    assert!(out.contains("defineComponent('pf-builder-button', PfBuilderButton);"));
}

#[test]
fn styles_only_no_registration() {
    let out = expand(
        "const css = `x`;\nclass Foo extends Component {\n    // #styles\n    styles = css;\n}",
    )
    .unwrap();
    assert!(out.contains("Foo.__sheets = [..._s0];"));
    assert!(!out.contains("defineComponent"));
    assert!(out.contains("import { sheet } from '@neuralfog/elemix/runtime';"));
}

#[test]
fn multiple_styles_accumulate_onto_a_class() {
    let out = expand(
        "const base = `a`;\nconst theme = `b`;\n// #component\nclass Foo extends Component {\n    // #styles\n    a = base;\n    // #styles\n    b = theme;\n}",
    )
    .unwrap();
    assert!(out.contains("const _s0 = sheet(base);"));
    assert!(out.contains("const _s1 = sheet(theme);"));
    assert!(out.contains("Foo.__sheets = [..._s0, ..._s1];"));
}

#[test]
fn no_pragmas_is_identity() {
    let src = "class Plain extends Component {}";
    assert_eq!(expand(src).unwrap(), src);
}

#[test]
fn unknown_directive_surfaces_as_error() {
    assert_eq!(
        expand("// #stules\nclass Foo extends Component {}"),
        Err(ExpandError::Resolve(PragmaError::Unknown(
            "stules".to_string()
        )))
    );
}

#[test]
fn orphan_surfaces_as_error() {
    assert_eq!(
        expand("// #component"),
        Err(ExpandError::Locate(LocateError::Orphan))
    );
}

#[test]
fn form_injects_form_associated_into_the_class_body() {
    let out =
        expand("// #component #form\nclass Field extends Component {\n    value = '';\n}").unwrap();
    assert!(out.contains("class Field extends Component {\n    static formAssociated = true;"));
    assert!(out.contains("defineComponent('field', Field);"));
    assert!(out.contains("value = '';"));
}

// --- #state ------------------------------------------------------------------

#[test]
fn state_field_wraps_the_initializer_and_lifts_the_annotation() {
    let src = "import { Component } from '@neuralfog/elemix';\nclass Foo extends Component {\n    // #state\n    s: AppState = { n: 0 };\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("s = state<AppState>({ n: 0 });")); // annotation → generic
    assert!(!out.contains("// #state"));
    assert!(!out.contains("s: AppState"));
}

#[test]
fn state_without_an_annotation_infers() {
    let src = "import { Component } from '@neuralfog/elemix';\nclass Foo extends Component {\n    // #state\n    s = { n: 0 };\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("s = state({ n: 0 });")); // no generic
}

#[test]
fn state_works_on_a_module_const() {
    let src = "import { Component } from '@neuralfog/elemix';\n// #state\nexport const cart: CartState = { items: [] };\nclass Foo extends Component {}";
    let out = expand(src).unwrap();
    assert!(out.contains("export const cart = state<CartState>({ items: [] });"));
}

#[test]
fn state_is_imported_from_runtime_not_the_public_barrel() {
    // `state` is a compile target now — never spliced into the public import.
    let src = "import { Component, tpl } from '@neuralfog/elemix';\nclass Foo extends Component {\n    // #state\n    s = { n: 0 };\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("import { state } from '@neuralfog/elemix/runtime';"));
    assert!(!out.contains(", state } from '@neuralfog/elemix';"));
    assert!(!out.contains("{ state, "));
}

#[test]
fn state_runtime_import_merges_with_define_component() {
    // a registered component with #state pulls both from /runtime, one import.
    let src = "// #component\nclass Foo extends Component {\n    // #state\n    s = { n: 0 };\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("defineComponent"));
    assert!(out.contains("state"));
    assert_eq!(out.matches("from '@neuralfog/elemix/runtime'").count(), 1);
}

#[test]
fn state_on_a_class_is_an_error() {
    assert_eq!(
        expand("// #state\nclass Foo extends Component {}"),
        Err(ExpandError::Resolve(PragmaError::OnClass(
            "state".to_string()
        )))
    );
}

#[test]
fn a_non_state_directive_on_a_const_errors() {
    assert_eq!(
        expand("// #styles\nconst css = `x`;"),
        Err(ExpandError::Locate(LocateError::OnConst(
            "styles".to_string()
        )))
    );
}

// --- #effect -----------------------------------------------------------------

#[test]
fn effect_on_a_method_generates_an_effects_hook() {
    let src =
        "// #component\nclass Foo extends Component {\n    // #effect\n    sync(): void {}\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("effects(): void {"));
    assert!(out.contains("effect(() => this.sync());"));
    assert!(out.contains("sync(): void {}")); // the method itself stays
    assert!(!out.contains("// #effect"));
    assert!(out.contains("from '@neuralfog/elemix/runtime'"));
}

#[test]
fn effect_works_on_an_arrow_field() {
    let src = "// #component\nclass Foo extends Component {\n    // #effect\n    sync = (): void => {};\n}";
    let out = expand(src).unwrap();
    assert!(out.contains("effect(() => this.sync());"));
}

#[test]
fn multiple_effects_share_one_hook() {
    let src = "// #component\nclass Foo extends Component {\n    // #effect\n    a(): void {}\n    // #effect\n    b(): void {}\n}";
    let out = expand(src).unwrap();
    assert_eq!(out.matches("effects(): void {").count(), 1);
    assert!(out.contains("effect(() => this.a());"));
    assert!(out.contains("effect(() => this.b());"));
}

#[test]
fn effect_on_a_class_is_an_error() {
    assert_eq!(
        expand("// #effect\nclass Foo extends Component {}"),
        Err(ExpandError::Resolve(PragmaError::OnClass(
            "effect".to_string()
        )))
    );
}
