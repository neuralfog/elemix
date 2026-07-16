//! Analyzer frontend (`scan`) — the component registry and prop-site spans the
//! analyzer is built on. The load-bearing invariant: a `PropSite`'s span slices
//! the ORIGINAL source back to its verbatim expr, even inside nested templates.

use elemix_compiler::scan::{
    scan_components, scan_element_uses, scan_hints, scan_imports, scan_props,
    scan_special_bindings, HintSeverity, SpecialKind,
};

/// Every prop site's absolute span must slice back to its own expr.
fn assert_spans_roundtrip(source: &str) {
    for site in scan_props(source) {
        let slice = &source[site.start as usize..site.end as usize];
        assert_eq!(
            slice, site.expr,
            "span [{}..{}] sliced {slice:?}, expected {:?}",
            site.start, site.end, site.expr
        );
    }
}

#[test]
fn component_explicit_tag() {
    let src = "// #component #tag user-card\nexport class UserCard extends Component<Props> {}";
    let decls = scan_components(src);
    assert_eq!(decls.len(), 1);
    assert_eq!(decls[0].tag, "user-card");
    assert_eq!(decls[0].class, "UserCard");
    assert!(decls[0].exported);
}

#[test]
fn component_derived_tag_is_kebab() {
    let src = "// #component\nexport class XMLBuilder extends Component {}";
    let decls = scan_components(src);
    assert_eq!(decls[0].tag, "xml-builder");
}

#[test]
fn component_without_export_is_flagged() {
    let src = "// #component\nclass Local extends Component {}";
    let decls = scan_components(src);
    assert_eq!(decls.len(), 1);
    assert!(!decls[0].exported);
}

#[test]
fn non_component_class_is_ignored() {
    let src = "export class Plain {}";
    assert!(scan_components(src).is_empty());
}

#[test]
fn prop_sites_carry_tag_name_and_exact_span() {
    let src = "const v = tpl`<user-card :name=${42} :role=${role}></user-card>`;";
    let sites = scan_props(src);
    assert_eq!(sites.len(), 2);

    assert_eq!(sites[0].tag, "user-card");
    assert_eq!(sites[0].prop, "name");
    assert_eq!(sites[0].expr, "42");

    assert_eq!(sites[1].prop, "role");
    assert_eq!(sites[1].expr, "role");

    assert_spans_roundtrip(src);
}

#[test]
fn attrs_events_refs_are_not_prop_sites() {
    let src = "const v = tpl`<user-card name=${x} @click=${go} :ref=${r}></user-card>`;";
    // Only `:prop` bindings are returned; the bare attr / event / ref are not.
    assert!(scan_props(src).is_empty());
}

#[test]
fn nested_template_prop_spans_are_absolute() {
    let src = "const v = tpl`<ul>${repeat(items, (i) => tpl`<user-card :name=${i}></user-card>`, (i) => i)}</ul>`;";
    let sites = scan_props(src);
    assert_eq!(sites.len(), 1);
    assert_eq!(sites[0].tag, "user-card");
    assert_eq!(sites[0].prop, "name");
    assert_eq!(sites[0].expr, "i");
    // The caret must land on the INNER `${i}`, not drift to the outer template.
    assert_spans_roundtrip(src);
}

// ---------------------------------------------------------------------------
// element usages (for required-prop checking)
// ---------------------------------------------------------------------------

/// Element usages of a given tag (the analyzer filters native tags by registry).
fn uses_of(src: &str, tag: &str) -> Vec<elemix_compiler::scan::ElementUse> {
    scan_element_uses(src)
        .into_iter()
        .filter(|u| u.tag == tag)
        .collect()
}

#[test]
fn element_use_groups_props_by_element_with_tag_span() {
    let src = "const v = tpl`<user-card :name=${a} :role=${b}></user-card>`;";
    let uses = uses_of(src, "user-card");
    assert_eq!(uses.len(), 1);
    assert_eq!(uses[0].provided, vec!["name", "role"]);
    // Tag span points at the tag NAME in the source.
    assert_eq!(
        &src[uses[0].tag_start as usize..uses[0].tag_end as usize],
        "user-card"
    );
}

#[test]
fn two_usages_of_the_same_tag_are_separate_elements() {
    let src = "const v = tpl`<div><user-card :name=${a}></user-card><user-card :role=${b}></user-card></div>`;";
    let uses = uses_of(src, "user-card");
    assert_eq!(uses.len(), 2);
    assert_eq!(uses[0].provided, vec!["name"]);
    assert_eq!(uses[1].provided, vec!["role"]);
}

#[test]
fn zero_prop_usage_is_surfaced_with_empty_provided() {
    // The "forgot everything" case — a usage that binds no props is still found,
    // so the analyzer can flag every required prop as missing.
    let src = "const v = tpl`<user-card></user-card>`;";
    let uses = uses_of(src, "user-card");
    assert_eq!(uses.len(), 1);
    assert!(uses[0].provided.is_empty());
}

#[test]
fn nested_template_element_uses_are_found() {
    let src = "const v = tpl`<ul>${repeat(items, (i) => tpl`<user-card :name=${i}></user-card>`, (i) => i)}</ul>`;";
    let uses = uses_of(src, "user-card");
    assert_eq!(uses.len(), 1);
    assert_eq!(uses[0].provided, vec!["name"]);
    assert_eq!(
        &src[uses[0].tag_start as usize..uses[0].tag_end as usize],
        "user-card"
    );
}

// ---------------------------------------------------------------------------
// special bindings (@event / :ref / ~model / ~onmodel)
// ---------------------------------------------------------------------------

#[test]
fn scan_special_bindings_classifies_each_kind() {
    let src = "const v = tpl`<button @click=${h} :ref=${r} ~model=${m} ~onmodel=${t}></button>`;";
    let b = scan_special_bindings(src);
    assert_eq!(b.len(), 4);
    assert_eq!(b[0].kind, SpecialKind::Event);
    assert_eq!(b[0].name.as_deref(), Some("click"));
    assert_eq!(b[0].expr, "h");
    assert_eq!(b[0].tag, "button");
    assert_eq!(b[1].kind, SpecialKind::Ref);
    assert_eq!(b[2].kind, SpecialKind::Model);
    assert_eq!(b[3].kind, SpecialKind::OnModel);
    // Spans slice back to the verbatim exprs.
    for site in &b {
        assert_eq!(&src[site.start as usize..site.end as usize], site.expr);
    }
}

#[test]
fn props_and_bare_attrs_are_not_special_bindings() {
    let src = "const v = tpl`<user-card :name=${x} title=${y}></user-card>`;";
    assert!(scan_special_bindings(src).is_empty());
}

// ---------------------------------------------------------------------------
// imports (for unimported-component detection)
// ---------------------------------------------------------------------------

#[test]
fn scan_imports_captures_specifiers_and_names() {
    let src = "import { UserCard } from './card';\n\
               import Foo from './foo';\n\
               import './side-effect';\n\
               export { Bar } from './bar';\n\
               export * from './all';";
    let imports = scan_imports(src);
    let specs: Vec<&str> = imports.iter().map(|i| i.specifier.as_str()).collect();
    assert_eq!(
        specs,
        vec!["./card", "./foo", "./side-effect", "./bar", "./all"]
    );
    assert_eq!(imports[0].names, vec!["UserCard"]);
    assert_eq!(imports[1].names, vec!["Foo"]);
    assert!(imports[2].names.is_empty()); // side-effect import
    assert_eq!(imports[3].names, vec!["Bar"]);
}

// ---------------------------------------------------------------------------
// compiler-hint diagnostics (spanned)
// ---------------------------------------------------------------------------

#[test]
fn clean_hints_have_no_diagnostics() {
    let src = "// #component #tag user-card\nexport class UserCard extends Component<Props> {}";
    assert!(scan_hints(src).is_empty());
}

#[test]
fn unknown_directive_is_an_error_at_the_class_name() {
    let src = "// #componnt\nexport class Foo extends Component {}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0]
        .message
        .contains("unknown compiler hint `#componnt`"));
    assert_eq!(diags[0].class.as_deref(), Some("Foo"));
    // The span must point at the offending HINT token in the comment, not the class.
    assert_eq!(
        &src[diags[0].start as usize..diags[0].end as usize],
        "componnt"
    );
}

#[test]
fn invalid_tag_is_an_error() {
    // A registered class whose DERIVED tag has no hyphen → invalid, and an error.
    // The caret is on the class name, so the message explains the derivation.
    let src = "// #component\nexport class Button extends Component {}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0].message.contains("derives the tag `button`"));
    assert!(diags[0].message.contains("must contain a hyphen"));
    assert!(diags[0].message.contains("rename the class"));
}

/// Run scan_hints and return the single error message for an explicit `#tag`.
fn tag_error(tag: &str) -> String {
    let src = format!("// #component #tag {tag}\nexport class Foo extends Component {{}}");
    let diags = scan_hints(&src);
    assert_eq!(diags.len(), 1, "expected one diagnostic for tag `{tag}`");
    assert_eq!(diags[0].severity, HintSeverity::Error);
    diags[0].message.clone()
}

#[test]
fn exhaustive_invalid_tag_reasons() {
    // reserved SVG/MathML name
    assert!(tag_error("font-face").contains("reserved by SVG/MathML"));
    // must start with a lowercase letter
    assert!(tag_error("1-card").contains("start with a lowercase"));
    // uppercase letters are rejected
    assert!(tag_error("my-Card").contains("must not contain uppercase"));
    // invalid character (hyphen present, so this is what trips)
    assert!(tag_error("my-c@rd").contains("invalid character"));
}

#[test]
fn valid_explicit_tag_is_clean() {
    let src = "// #component #tag user-card\nexport class Foo extends Component {}";
    assert!(scan_hints(src).is_empty());
}

#[test]
fn explicit_invalid_tag_carets_the_tag_value_not_the_class() {
    // The diagnostic validates the HINT, so its span must land on the `#tag` value.
    let src = "// #component #tag my-c@rd\nexport class Foo extends Component {}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(
        &src[diags[0].start as usize..diags[0].end as usize],
        "my-c@rd"
    );
}

#[test]
fn derived_invalid_tag_carets_the_class_name() {
    // No explicit `#tag` — the tag is derived from the class name, so THAT is the
    // source of the problem and the right thing to caret.
    let src = "// #component\nexport class Button extends Component {}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(
        &src[diags[0].start as usize..diags[0].end as usize],
        "Button"
    );
}

#[test]
fn unknown_directive_on_a_member_carets_the_member_not_the_file_head() {
    // Regression: an unknown hint on a field/method used to collapse to offset 0
    // (line 1). It must caret the member the bad hint is attached to.
    let src = "export class Foo extends Component {\n    // #effectdfsd\n    doThing() {}\n}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0].message.contains("effectdfsd"));
    assert_eq!(
        &src[diags[0].start as usize..diags[0].end as usize],
        "doThing"
    );
}

#[test]
fn tag_arity_error_is_reported() {
    let src = "// #component #tag a b\nexport class Foo extends Component {}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0].message.contains("#tag needs exactly one"));
}

#[test]
fn module_state_primitive_is_an_error() {
    // A module-level `#state` store must hold an object — a bare primitive export
    // can't be made reactive single-file (no `this` to back an accessor).
    let src = "// #state\nexport const count = 0;";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0]
        .message
        .contains("module-level `#state` must be an object"));
    assert_eq!(diags[0].class, None);
    // Spanned, so the analyzer can frame the offending initializer.
    assert!(diags[0].end > diags[0].start);
}

#[test]
fn module_state_object_store_is_clean() {
    let src = "// #state\nexport const store = { count: 0 };";
    assert!(scan_hints(src).is_empty());
}

#[test]
fn lifecycle_hook_on_non_function_field_is_an_error() {
    let src =
        "// #component #tag a-comp\nexport class A extends Component {\n// #effect\nbad = 42;\n}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0]
        .message
        .contains("must tag a method or an arrow function"));
    assert_eq!(diags[0].class.as_deref(), Some("A"));
    // Carets the offending field name.
    assert_eq!(&src[diags[0].start as usize..diags[0].end as usize], "bad");
}

#[test]
fn state_on_arrow_field_is_an_error() {
    let src = "// #component #tag a-comp\nexport class A extends Component {\n// #state\nbad = (): void => {};\n}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0]
        .message
        .contains("must tag a data field, not a function"));
    assert_eq!(&src[diags[0].start as usize..diags[0].end as usize], "bad");
}

#[test]
fn state_on_method_is_an_error() {
    let src =
        "// #component #tag a-comp\nexport class A extends Component {\n// #state\nm(): void {}\n}";
    let diags = scan_hints(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, HintSeverity::Error);
    assert!(diags[0]
        .message
        .contains("must tag a data field, not a method"));
    assert_eq!(&src[diags[0].start as usize..diags[0].end as usize], "m");
}

#[test]
fn state_on_data_field_is_clean() {
    let src =
        "// #component #tag a-comp\nexport class A extends Component {\n// #state\ncount = 0;\n}";
    assert!(scan_hints(src).is_empty());
}

#[test]
fn lifecycle_hooks_on_method_and_arrow_field_are_clean() {
    // A normal method and an arrow-function field are both valid hook targets.
    let src = "// #component #tag a-comp\nexport class A extends Component {\n\
               // #mount\nm() {}\n\
               // #effect\ne = (): void => {};\n\
               // #dispose\nd = function () {};\n}";
    assert!(scan_hints(src).is_empty());
}
