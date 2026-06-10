//! Splice tests — helper templates referenced by variable or method are inlined
//! and lowered to one-time `_child` builders; the component compiles end-to-end.

use elemix_compiler::compile;
use elemix_compiler::splice::inline_helpers;

const CLASS_MEMBER: &str = r#"import { Component, defineComponent } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class PanelApp extends Component {
    headerTemplate = (): Template => tpl`<h2>${this.title}</h2>`;
    template = (): Template => tpl`<div>${this.headerTemplate()}<button @click=${this.add}>add</button></div>`;
}
defineComponent('panel-app', PanelApp);
"#;

const LOCAL_CONST: &str = r#"import { Component, defineComponent } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class NestedApp extends Component {
    template = (): Template => {
        const chip = tpl`<span>${this.tag}</span>`;
        return tpl`<div>${chip} and ${chip}</div>`;
    };
}
defineComponent('nested-app', NestedApp);
"#;

const SINGLE: &str = r#"import { Component, defineComponent } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class CounterApp extends Component {
    template = (): Template => tpl`<button @click=${this.inc}>${this.count}</button>`;
}
defineComponent('counter-app', CounterApp);
"#;

#[test]
fn class_member_helper_is_inlined_and_spliced() {
    let out = compile(CLASS_MEMBER);
    // the helper member is gone, no html intrinsic survives
    assert!(!out.contains("headerTemplate"));
    assert!(!out.contains("tpl`"));
    // spliced via _child, with the header template hoisted + cloned
    assert!(out.contains("_child("));
    assert!(out.contains("<h2><!----></h2>"));
    assert!(out.contains(".firstChild!"));
}

#[test]
fn local_const_helper_is_inlined() {
    let out = compile(LOCAL_CONST);
    assert!(!out.contains("const chip"));
    assert!(!out.contains("tpl`"));
    // chip is embedded twice → two independent _child splices
    assert_eq!(out.matches("_child(").count(), 2);
}

#[test]
fn single_template_component_is_untouched_by_the_prepass() {
    // no helpers → inline_helpers is identity
    assert_eq!(inline_helpers(SINGLE), SINGLE);
}
