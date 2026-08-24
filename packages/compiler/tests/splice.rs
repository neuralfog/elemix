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
    assert!(!out.contains("headerTemplate"));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("$__child("));
    assert!(out.contains("<h2> </h2>"));
    assert!(out.contains(".firstChild!"));
}

#[test]
fn local_const_helper_is_inlined() {
    let out = compile(LOCAL_CONST);
    assert!(!out.contains("const chip"));
    assert!(!out.contains("tpl`"));
    assert_eq!(out.matches("$__child(").count(), 2);
}

#[test]
fn single_template_component_is_untouched_by_the_prepass() {
    assert_eq!(inline_helpers(SINGLE), SINGLE);
}

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

const PARAM_HELPER: &str = r#"import { Component, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
export class RowList extends Component {
    state = $__state<{ rows: { id: number; name: string }[] }>({ rows: [] });
    row = (item: { id: number; name: string }): Template => tpl`<li data-id=${item.id}>${item.name}</li>`;
    template = (): Template => tpl`<ul>${repeat(this.state.rows, (r) => this.row(r), (r) => r.id)}</ul>`;
}
defineComponent('row-list', RowList);
"#;

#[test]
fn parameterized_helper_is_inlined_with_arg_substituted() {
    let out = compile(PARAM_HELPER);
    assert!(!out.contains("row ="));
    assert!(!out.contains("this.row("));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("($__toRaw(r).id)"));
    assert!(out.contains("(r.name)"));
    assert!(!out.contains("item.id"));
    assert!(out.contains("$__list("));
}

#[test]
fn helper_on_a_non_first_component_is_inlined() {
    let out = compile(HELPER_ON_SECOND);
    assert!(!out.contains("heading ="));
    assert!(!out.contains("this.heading()"));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("<h2>Title</h2>"));
    assert!(out.contains("$__child("));
    assert_eq!(out.matches("$$__view(): DocumentFragment").count(), 2);
}

const METHOD_MAIN_HELPER: &str = r#"import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class PanelApp extends Component {
    cell = (k: string): Template => tpl`<td>${k}</td>`;
    template(): Template {
        return tpl`<tr>${this.cell('a')}${this.cell('b')}</tr>`;
    }
}
defineComponent('panel-app', PanelApp);
"#;

#[test]
fn method_form_template_inlines_its_helpers() {
    let out = compile(METHOD_MAIN_HELPER);
    assert!(!out.contains("cell ="));
    assert!(!out.contains("this.cell("));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("$$__view(): DocumentFragment"));
}

const NESTED_HELPER_CALL: &str = r#"import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class PanelApp extends Component {
    on = true;
    chip = (k: string): Template => tpl`<i>${k}</i>`;
    template = (): Template => tpl`<div>${this.on ? tpl`<p>${this.chip('a')}${this.chip('b')}</p>` : tpl``}</div>`;
}
defineComponent('panel-app', PanelApp);
"#;

#[test]
fn helper_call_inside_a_nested_template_is_inlined() {
    let out = compile(NESTED_HELPER_CALL);
    assert!(!out.contains("chip ="));
    assert!(!out.contains("this.chip("));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("$$__view(): DocumentFragment"));
}
