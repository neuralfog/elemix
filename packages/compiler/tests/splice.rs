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
    assert!(out.contains("<h2> </h2>"));
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

// A helper lives on the SECOND component — splice must inline helpers for every
// class in the file, not just the first.
const HELPER_ON_SECOND: &str = r#"import { Component, defineComponent } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class Plain extends Component {
    template = (): Template => tpl`<span>plain</span>`;
}
export class Titled extends Component {
    heading = (): Template => tpl`<h2>Title</h2>`;
    template = (): Template => tpl`<div>${this.heading()}<p>body</p></div>`;
}
defineComponent('plain-el', Plain);
defineComponent('titled-el', Titled);
"#;

// A parameterized helper `row = (item) => tpl`…`` called as `this.row(r)` inside
// a repeat — splice inlines it with `item` substituted for the arg `r`.
const PARAM_HELPER: &str = r#"import { Component, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
export class RowList extends Component {
    state = state<{ rows: { id: number; name: string }[] }>({ rows: [] });
    row = (item: { id: number; name: string }): Template => tpl`<li data-id=${item.id}>${item.name}</li>`;
    template = (): Template => tpl`<ul>${repeat(this.state.rows, (r) => this.row(r), (r) => r.id)}</ul>`;
}
defineComponent('row-list', RowList);
"#;

#[test]
fn parameterized_helper_is_inlined_with_arg_substituted() {
    let out = compile(PARAM_HELPER);
    // the helper member is gone, no this.row call survives, no tpl bleeds
    assert!(!out.contains("row ="));
    assert!(!out.contains("this.row("));
    assert!(!out.contains("tpl`"));
    // the param `item` was substituted for the call's arg `r` in the holes;
    // r.id is the set-once key (read raw), r.name stays a tracked Proxy read
    assert!(out.contains("(toRaw(r).id)"));
    assert!(out.contains("(r.name)"));
    assert!(!out.contains("item.id"));
    // and it lowered to a keyed list
    assert!(out.contains("_list("));
}

#[test]
fn helper_on_a_non_first_component_is_inlined() {
    let out = compile(HELPER_ON_SECOND);
    // the second component's helper got inlined + spliced, not left behind
    assert!(!out.contains("heading ="));
    assert!(!out.contains("this.heading()"));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("<h2>Title</h2>"));
    assert!(out.contains("_child("));
    // both components still compiled
    assert_eq!(out.matches("view(): DocumentFragment").count(), 2);
}
