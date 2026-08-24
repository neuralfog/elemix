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
    assert!(out.contains("unknown compiler hint `#frobnicate`"));
    let (_, diags) = compile_diagnostics(UNKNOWN_PRAGMA);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Error);
    assert_eq!(diags[0].component.as_deref(), Some("WidgetApp"));
}

#[test]
fn unknown_hint_on_a_field_reads_as_unknown_and_names_the_component() {
    let src = "import { Component } from '@neuralfog/elemix';
export class MatchApp extends Component {
    // #statesdf
    state = { tab: 1 };
}";
    let out = compile(src);
    assert!(
        out.starts_with("throw new Error('[elemix] MatchApp: unknown compiler hint `#statesdf`');")
    );
    assert!(!out.contains("can't tag a field"));
    let (_, diags) = compile_diagnostics(src);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].component.as_deref(), Some("MatchApp"));
}

#[test]
fn hyphenless_tag_warns_but_still_compiles() {
    let out = compile(HYPHENLESS);
    assert!(out.contains("console.warn('[elemix] Widget:"));
    assert!(out.contains("derives the tag `widget`"));
    assert!(out.contains("must contain a hyphen"));
    assert!(!out.contains("throw new Error("));
    assert!(out.contains("$__defineComponent('widget', Widget)"));
    assert!(out.contains("$$__view(): DocumentFragment"));

    let (_, diags) = compile_diagnostics(HYPHENLESS);
    assert_eq!(diags.len(), 1);
    assert_eq!(diags[0].severity, Severity::Warning);
    assert!(!has_errors(&diags));
}

#[test]
fn multiword_class_has_no_tag_warning() {
    let (_, diags) = compile_diagnostics(CLEAN);
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
    let warn = out.find("console.warn(").expect("a warn");
    let thrown = out.find("throw new Error(").expect("a throw");
    assert!(warn < thrown);
}

#[test]
fn js_str_escapes_quotes_and_newlines() {
    assert_eq!(js_str("a'b"), "'a\\'b'");
    assert_eq!(js_str("a\nb"), "'a\\nb'");
    assert_eq!(js_str("a\\b"), "'a\\\\b'");
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
