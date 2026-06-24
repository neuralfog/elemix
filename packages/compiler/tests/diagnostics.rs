//! Compile-time diagnostics: errors inline a module-scope `throw`, warnings a
//! `console.warn`, and a clean source is left untouched.

use elemix_compiler::diagnostics::{has_errors, inline, js_str, Diagnostic, Severity};
use elemix_compiler::{compile, compile_diagnostics};

const CLEAN: &str = "import { Component, tpl } from '@neuralfog/elemix';
// #component
export class CounterApp extends Component {
    template = () => tpl`<button>hi</button>`;
}";

const UNKNOWN_PRAGMA: &str = "import { Component, tpl } from '@neuralfog/elemix';
// #component #frobnicate
export class WidgetApp extends Component {
    template = () => tpl`<button>hi</button>`;
}";

const HYPHENLESS: &str = "import { Component, tpl } from '@neuralfog/elemix';
// #component
export class Widget extends Component {
    template = () => tpl`<button>hi</button>`;
}";

#[test]
fn clean_source_is_untouched() {
    let out = compile(CLEAN);
    assert!(!out.contains("throw new Error("));
    assert!(!out.contains("console.warn("));
    let (_, diags) = compile_diagnostics(CLEAN);
    assert!(diags.is_empty());
}

#[test]
fn unknown_pragma_inlines_a_throw_naming_the_component() {
    let out = compile(UNKNOWN_PRAGMA);
    assert!(out.starts_with("throw new Error('[elemix] WidgetApp:"));
    assert!(out.contains("unknown pragma directive `#frobnicate`"));
    // the throw aborts at module scope before the (un-upgradable) component
    let (_, diags) = compile_diagnostics(UNKNOWN_PRAGMA);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Error);
    assert_eq!(diags[0].component.as_deref(), Some("WidgetApp"));
}

#[test]
fn hyphenless_tag_warns_but_still_compiles() {
    let out = compile(HYPHENLESS);
    assert!(out.contains("console.warn('[elemix] Widget:"));
    // derived tag → the message explains the derivation + how to fix it.
    assert!(out.contains("derives the tag `widget`"));
    assert!(out.contains("must contain a hyphen"));
    // a warning never blocks: the component is still registered + has a view
    assert!(!out.contains("throw new Error("));
    assert!(out.contains("defineComponent('widget', Widget)"));
    assert!(out.contains("view(): DocumentFragment"));

    let (_, diags) = compile_diagnostics(HYPHENLESS);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Warning);
    assert!(!has_errors(&diags));
}

#[test]
fn multiword_class_has_no_tag_warning() {
    let (_, diags) = compile_diagnostics(CLEAN); // CounterApp -> counter-app
    assert!(diags.is_empty());
}

#[test]
fn explicit_hyphenless_tag_warns() {
    let src = "import { Component, tpl } from '@neuralfog/elemix';
// #component #tag widget
export class WidgetApp extends Component {
    template = () => tpl`<button>hi</button>`;
}";
    let (_, diags) = compile_diagnostics(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Warning);
    assert!(diags[0].message.contains("widget"));
}

#[test]
fn warnings_and_errors_both_collected() {
    let src = "import { Component, tpl } from '@neuralfog/elemix';
// #component
export class Widget extends Component {
    template = () => tpl`<i>a</i>`;
}
// #component #frobnicate
export class OtherApp extends Component {
    template = () => tpl`<i>b</i>`;
}";
    let (out, diags) = compile_diagnostics(src);
    assert_eq!(diags.len(), 2);
    assert!(has_errors(&diags));
    // warning logs before the throw aborts
    let warn = out.find("console.warn(").expect("a warn");
    let thrown = out.find("throw new Error(").expect("a throw");
    assert!(warn < thrown);
}

// --- unit: the emission primitives ---

#[test]
fn js_str_escapes_quotes_and_newlines() {
    assert_eq!(js_str("a'b"), "'a\\'b'");
    assert_eq!(js_str("a\nb"), "'a\\nb'");
    assert_eq!(js_str("a\\b"), "'a\\\\b'");
    // backticks and double quotes are safe inside single quotes
    assert_eq!(js_str("a`b\"c"), "'a`b\"c'");
}

#[test]
fn render_prefixes_elemix_and_component() {
    let d = Diagnostic::error(Some("App".into()), "boom");
    assert_eq!(d.render(), "[elemix] App: boom");
    let f = Diagnostic::warning(None, "loose");
    assert_eq!(f.render(), "[elemix] loose");
}

const PRIMITIVE_MODULE_STATE: &str = "// #state\nexport const count = 0;";
const OBJECT_MODULE_STATE: &str = "// #state\nexport const store = { count: 0 };";

#[test]
fn module_level_primitive_state_is_an_error() {
    let out = compile(PRIMITIVE_MODULE_STATE);
    assert!(out.contains("throw new Error('[elemix] module-level `#state` must be an object"));
    let (_, diags) = compile_diagnostics(PRIMITIVE_MODULE_STATE);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Error);
    assert!(has_errors(&diags));
}

#[test]
fn module_level_object_state_is_clean() {
    let (_, diags) = compile_diagnostics(OBJECT_MODULE_STATE);
    assert!(diags.is_empty());
}

#[test]
fn class_field_primitive_state_is_clean() {
    // bare primitives ARE allowed as class fields (they lower to an accessor),
    // so they must never trip the module-state error.
    let src = "import { Component } from '@neuralfog/elemix';\nexport class Foo extends Component {\n    // #state\n    count = 0;\n}";
    let (_, diags) = compile_diagnostics(src);
    assert!(diags.is_empty());
}

#[test]
fn inline_is_identity_without_diagnostics() {
    assert_eq!(inline("CODE", &[]), "CODE");
}

#[test]
fn inline_orders_warnings_before_errors() {
    let diags = vec![
        Diagnostic::error(None, "bad"),
        Diagnostic::warning(None, "meh"),
    ];
    let out = inline("CODE", &diags);
    let warn = out.find("console.warn(").unwrap();
    let err = out.find("throw new Error(").unwrap();
    assert!(warn < err);
    assert!(out.ends_with("CODE"));
}
