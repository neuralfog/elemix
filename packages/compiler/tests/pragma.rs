//! Tests for the generic pragma layer — directive splitting, the resolve
//! extension point, and tag derivation. The splitter is the error-prone part
//! (interleaved statics/holes, `#` inside interpolations), so it is unit-tested
//! directly, the same way the template scanners are.

use elemix_compiler::pragma::locate::{locate, LocateError};
use elemix_compiler::pragma::lower::{expand, ExpandError};
use elemix_compiler::pragma::parse::{is_pragma, split_block, split_directives};
use elemix_compiler::pragma::{kebab, resolve, Arg, ComponentMeta, Directive, PragmaError};

fn s(v: &[&str]) -> Vec<String> {
    v.iter().map(|x| x.to_string()).collect()
}

fn word(w: &str) -> Arg {
    Arg::Word(w.to_string())
}
fn expr(e: &str) -> Arg {
    Arg::Expr(e.to_string())
}
fn dir(name: &str, args: Vec<Arg>) -> Directive {
    Directive {
        name: name.to_string(),
        args,
    }
}

// --- splitting ---------------------------------------------------------------

#[test]
fn splits_a_flag_directive() {
    assert_eq!(
        split_directives(&s(&["#component"]), &[]),
        vec![dir("component", vec![])]
    );
}

#[test]
fn splits_a_single_word_directive() {
    assert_eq!(
        split_directives(&s(&["#tag pf-builder"]), &[]),
        vec![dir("tag", vec![word("pf-builder")])]
    );
}

#[test]
fn splits_a_hole_into_an_expr_arg() {
    // `#styles ${[css]}`  → quasis ["#styles ", ""], exprs ["[css]"]
    assert_eq!(
        split_directives(&s(&["#styles ", ""]), &s(&["[css]"])),
        vec![dir("styles", vec![expr("[css]")])]
    );
}

#[test]
fn splits_many_directives_on_one_line() {
    // `#component #tag pf-builder #styles ${[css]}`
    assert_eq!(
        split_directives(
            &s(&["#component #tag pf-builder #styles ", ""]),
            &s(&["[css]"])
        ),
        vec![
            dir("component", vec![]),
            dir("tag", vec![word("pf-builder")]),
            dir("styles", vec![expr("[css]")]),
        ]
    );
}

#[test]
fn hash_inside_an_interpolation_is_not_a_directive() {
    // `#styles ${'#fff'}` — the `#` lives in the expr, not the static text.
    assert_eq!(
        split_directives(&s(&["#styles ", ""]), &s(&["'#fff'"])),
        vec![dir("styles", vec![expr("'#fff'")])]
    );
}

#[test]
fn block_merges_statements_in_order() {
    // multi-line == one line: `#component` / `#tag x` / `#styles ${[css]}`
    let stmts = vec![
        (s(&["#component"]), s(&[])),
        (s(&["#tag pf-builder"]), s(&[])),
        (s(&["#styles ", ""]), s(&["[css]"])),
    ];
    assert_eq!(
        split_block(&stmts),
        vec![
            dir("component", vec![]),
            dir("tag", vec![word("pf-builder")]),
            dir("styles", vec![expr("[css]")]),
        ]
    );
}

#[test]
fn is_pragma_detects_leading_hash() {
    assert!(is_pragma("#component"));
    assert!(is_pragma("  #styles "));
    assert!(!is_pragma("hello"));
    assert!(!is_pragma(""));
}

// --- resolve (the extension point) -------------------------------------------

#[test]
fn resolves_a_full_block() {
    let dirs = vec![
        dir("component", vec![]),
        dir("tag", vec![word("pf-builder")]),
        dir("styles", vec![expr("[css]")]),
    ];
    assert_eq!(
        resolve(&dirs),
        Ok(ComponentMeta {
            register: true,
            tag: Some("pf-builder".to_string()),
            styles: vec![expr("[css]")],
            form: false,
        })
    );
}

#[test]
fn styles_accumulate_across_directives() {
    let dirs = vec![
        dir("styles", vec![expr("[base]")]),
        dir("styles", vec![expr("[theme]")]),
    ];
    assert_eq!(
        resolve(&dirs).unwrap().styles,
        vec![expr("[base]"), expr("[theme]")]
    );
}

#[test]
fn unknown_directive_is_an_error() {
    assert_eq!(
        resolve(&[dir("stules", vec![])]),
        Err(PragmaError::Unknown("stules".to_string()))
    );
}

#[test]
fn conflicting_tags_error() {
    let dirs = vec![dir("tag", vec![word("a-b")]), dir("tag", vec![word("c-d")])];
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
    let dirs = vec![dir("tag", vec![word("a-b")]), dir("tag", vec![word("a-b")])];
    assert_eq!(resolve(&dirs).unwrap().tag, Some("a-b".to_string()));
}

#[test]
fn tag_needs_exactly_one_word() {
    assert_eq!(resolve(&[dir("tag", vec![])]), Err(PragmaError::TagArity));
    assert_eq!(
        resolve(&[dir("tag", vec![expr("x")])]),
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
    // intentionally invalid — runtime `customElements.define` rejects it
    assert_eq!(kebab("Button"), "button");
}

// --- locate (oxc detection + association) ------------------------------------

fn one(source: &str) -> (Vec<Directive>, String) {
    let mut blocks = locate(source).expect("should locate");
    assert_eq!(blocks.len(), 1, "expected exactly one block");
    let b = blocks.remove(0);
    (b.directives, b.class_name)
}

#[test]
fn locates_a_one_line_block() {
    let (dirs, name) = one(
        "const css = `x`;\n`#component #tag pf-builder #styles ${[css]}`\nclass PfBuilder extends Component {}",
    );
    assert_eq!(name, "PfBuilder");
    assert_eq!(
        dirs,
        vec![
            dir("component", vec![]),
            dir("tag", vec![word("pf-builder")]),
            dir("styles", vec![expr("[css]")]),
        ]
    );
}

#[test]
fn multi_line_block_equals_one_line() {
    let (dirs, name) = one(
        "`#component`\n`#tag pf-builder`\n`#styles ${[css]}`\nclass PfBuilder extends Component {}",
    );
    assert_eq!(name, "PfBuilder");
    assert_eq!(
        dirs,
        vec![
            dir("component", vec![]),
            dir("tag", vec![word("pf-builder")]),
            dir("styles", vec![expr("[css]")]),
        ]
    );
}

#[test]
fn binds_to_an_exported_class() {
    let (_dirs, name) = one("`#component`\nexport class Widget extends Component {}");
    assert_eq!(name, "Widget");
}

#[test]
fn two_components_in_one_file() {
    let blocks = locate(
        "`#component`\nclass A extends Component {}\n`#component #tag b-tag`\nclass B extends Component {}",
    )
    .unwrap();
    assert_eq!(blocks.len(), 2);
    assert_eq!(blocks[0].class_name, "A");
    assert_eq!(blocks[1].class_name, "B");
    assert_eq!(blocks[1].directives[1], dir("tag", vec![word("b-tag")]));
}

#[test]
fn classes_without_pragmas_are_ignored() {
    let blocks = locate("class Plain extends Component {}").unwrap();
    assert!(blocks.is_empty());
}

#[test]
fn pragma_with_no_class_is_orphan() {
    assert_eq!(
        locate("`#component`\nconst x = 1;"),
        Err(LocateError::Orphan)
    );
    assert_eq!(locate("`#component`"), Err(LocateError::Orphan));
}

#[test]
fn statement_between_block_and_class_is_orphan() {
    assert_eq!(
        locate("`#component`\nconst x = 1;\nclass Foo extends Component {}"),
        Err(LocateError::Orphan)
    );
}

#[test]
fn imports_before_a_block_are_fine() {
    let (_dirs, name) = one(
        "import { Component } from '@neuralfog/elemix';\n`#component`\nclass Foo extends Component {}",
    );
    assert_eq!(name, "Foo");
}

// --- expand (lowering) -------------------------------------------------------

#[test]
fn lowers_a_full_component() {
    let src =
        "import css from 'x';\n`#component #styles ${css}`\nclass PfBuilder extends Component {}";
    let want = "import { defineComponent, sheet } from '@neuralfog/elemix/runtime';\n\
                import css from 'x';\n\
                const _s0 = sheet(css);\n\
                class PfBuilder extends Component {}\n\
                PfBuilder.__sheets = [..._s0];\n\
                defineComponent('pf-builder', PfBuilder);";
    assert_eq!(expand(src).unwrap(), want);
}

#[test]
fn multi_line_lowers_identically_to_one_line() {
    let one = "`#component #styles ${css}`\nclass Foo extends Component {}";
    let multi = "`#component`\n`#styles ${css}`\nclass Foo extends Component {}";
    assert_eq!(expand(one).unwrap(), expand(multi).unwrap());
}

#[test]
fn explicit_tag_overrides_derivation() {
    let out = expand("`#component #tag my-thing`\nclass Foo extends Component {}").unwrap();
    assert!(out.contains("defineComponent('my-thing', Foo);"));
    assert!(!out.contains("'foo'"));
}

#[test]
fn derives_tag_from_class_name() {
    let out = expand("`#component`\nclass PfBuilderButton extends Component {}").unwrap();
    assert!(out.contains("defineComponent('pf-builder-button', PfBuilderButton);"));
}

#[test]
fn styles_only_no_registration() {
    let out = expand("`#styles ${css}`\nclass Foo extends Component {}").unwrap();
    assert!(out.contains("Foo.__sheets = [..._s0];"));
    assert!(!out.contains("defineComponent"));
    assert!(out.contains("import { sheet } from '@neuralfog/elemix/runtime';"));
}

#[test]
fn dedupes_shared_stylesheets() {
    // both classes adopt the same css → one hoisted sheet const.
    let out = expand(
        "`#component #styles ${css}`\nclass A extends Component {}\n`#component #styles ${css}`\nclass B extends Component {}",
    )
    .unwrap();
    assert_eq!(out.matches("= sheet(css);").count(), 1);
    assert!(out.contains("A.__sheets = [..._s0];"));
    assert!(out.contains("B.__sheets = [..._s0];"));
}

#[test]
fn no_pragmas_is_identity() {
    let src = "class Plain extends Component {}";
    assert_eq!(expand(src).unwrap(), src);
}

#[test]
fn unknown_directive_surfaces_as_error() {
    assert_eq!(
        expand("`#component #stules ${css}`\nclass Foo extends Component {}"),
        Err(ExpandError::Resolve(PragmaError::Unknown(
            "stules".to_string()
        )))
    );
}

#[test]
fn orphan_block_surfaces_as_error() {
    assert_eq!(
        expand("`#component`\nconst x = 1;"),
        Err(ExpandError::Locate(LocateError::Orphan))
    );
}

#[test]
fn form_resolves_to_a_flag() {
    assert!(resolve(&[dir("form", vec![])]).unwrap().form);
    assert!(!resolve(&[dir("component", vec![])]).unwrap().form);
}

#[test]
fn form_injects_form_associated_into_the_class_body() {
    let out =
        expand("`#component #form`\nclass Field extends Component {\n    value = '';\n}").unwrap();
    assert!(out.contains("class Field extends Component {\n    static formAssociated = true;"));
    assert!(out.contains("defineComponent('field', Field);"));
    // the original member is still there, after the injected one
    assert!(out.contains("value = '';"));
}
