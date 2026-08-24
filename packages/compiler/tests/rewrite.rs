use elemix_compiler::compile;

const COUNTER: &str = r#"import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class CounterApp extends Component {
    state = $__state({ count: 0 });
    template = (): Template => tpl`<button @click=${this.inc}>${this.state.count}</button>`;
}
defineComponent('counter-app', CounterApp);
"#;

const WITH_REPEAT: &str = r#"import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
export class ListApp extends Component {
    state = $__state({ rows: [] as { id: number }[] });
    template = (): Template => tpl`<ul>${repeat(this.state.rows, (r) => tpl`<li>${r.id}</li>`, (r) => r.id)}</ul>`;
}
defineComponent('list-app', ListApp);
"#;

const ONLY_TPL: &str = r#"import { tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class SoloApp extends Component {
    template = (): Template => tpl`<div>${this.value}</div>`;
}
defineComponent('solo-app', SoloApp);
"#;

#[test]
fn tpl_is_stripped_from_the_main_import() {
    let out = compile(COUNTER);
    assert!(out.contains("import { Component, defineComponent, state } from '@neuralfog/elemix';"));
    assert!(!out.contains("tpl"));
}

#[test]
fn directives_import_is_dropped() {
    let out = compile(WITH_REPEAT);
    assert!(!out.contains("@neuralfog/elemix/directives"));
    assert!(!out.contains("repeat("));
    assert!(out.contains("import { Component, defineComponent, state } from '@neuralfog/elemix';"));
    assert!(!out.contains("tpl"));
}

#[test]
fn main_import_is_dropped_when_only_tpl_remained() {
    let out = compile(ONLY_TPL);
    assert!(!out.contains("from '@neuralfog/elemix';"));
    assert!(out.contains("from '@neuralfog/elemix/runtime';"));
}

const BLOCK_BODY: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class DestructApp extends Component {
    inc = (): void => {};
    template = (): Template => {
        const { inc } = this;
        return tpl`<button @click=${inc}>${this.state.count}</button>`;
    };
}
defineComponent('destruct-app', DestructApp);
"#;

const TWO_COMPONENTS: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class A extends Component {
    template = (): Template => tpl`<span>${this.x}</span>`;
}
export class B extends Component {
    template = (): Template => tpl`<div>${this.y}</div>`;
}
defineComponent('a-el', A);
defineComponent('b-el', B);
"#;

#[test]
fn multiple_components_per_file_each_compile() {
    let out = compile(TWO_COMPONENTS);
    assert_eq!(out.matches("$$__view(): DocumentFragment").count(), 2);
    assert!(!out.contains("tpl`"));
    assert!(out.contains("const _t0 = $__template("));
    assert!(out.contains("const _t1 = $__template("));
}

#[test]
fn block_body_prelude_survives_into_view() {
    let out = compile(BLOCK_BODY);
    assert!(out.contains("$$__view(): DocumentFragment {"));
    assert!(out.contains("const { inc } = this;"));
    let view_at = out.find("$$__view(): DocumentFragment").unwrap();
    let destruct_at = out.find("const { inc } = this;").unwrap();
    let clone_at = out.find("$__clone(").unwrap();
    assert!(view_at < destruct_at && destruct_at < clone_at);
    assert!(!out.contains("tpl`"));
}

const METHOD_FORM: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class MethodApp extends Component {
    inc = (): void => {};
    template(): Template {
        return tpl`<button @click=${this.inc}>${this.count}</button>`;
    }
}
defineComponent('method-app', MethodApp);
"#;

const METHOD_PRELUDE: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class MethodDestructApp extends Component {
    inc = (): void => {};
    template(): Template {
        const { inc } = this;
        return tpl`<button @click=${inc}>${this.count}</button>`;
    }
}
defineComponent('method-destruct-app', MethodDestructApp);
"#;

const METHOD_WITH_GETTER: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class GetterApp extends Component {
    private get cls(): string {
        return 'box';
    }
    template(): Template {
        return tpl`<div class=${this.cls}>hi</div>`;
    }
}
defineComponent('getter-app', GetterApp);
"#;

#[test]
fn method_form_template_lowers() {
    let out = compile(METHOD_FORM);
    assert_eq!(out.matches("$$__view(): DocumentFragment").count(), 1);
    assert!(!out.contains("template(): Template"));
    assert!(!out.contains("tpl`"));
    assert!(out.contains("$__event("));
}

#[test]
fn method_form_prelude_survives_into_view() {
    let out = compile(METHOD_PRELUDE);
    assert!(out.contains("$$__view(): DocumentFragment {"));
    assert!(out.contains("const { inc } = this;"));
    let view_at = out.find("$$__view(): DocumentFragment").unwrap();
    let destruct_at = out.find("const { inc } = this;").unwrap();
    let clone_at = out.find("$__clone(").unwrap();
    assert!(view_at < destruct_at && destruct_at < clone_at);
    assert!(!out.contains("tpl`"));
}

#[test]
fn method_template_lowers_alongside_a_getter() {
    let out = compile(METHOD_WITH_GETTER);
    assert!(out.contains("$$__view(): DocumentFragment {"));
    assert!(out.contains("get cls(): string"));
    assert!(!out.contains("tpl`"));
}

#[test]
fn method_and_arrow_forms_lower_identically() {
    const ARROW: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class W extends Component {
    template = (): Template => tpl`<button @click=${this.inc}>${this.count}</button>`;
}
defineComponent('w-el', W);
"#;
    const METHOD: &str = r#"import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class W extends Component {
    template(): Template {
        return tpl`<button @click=${this.inc}>${this.count}</button>`;
    }
}
defineComponent('w-el', W);
"#;
    let view = |src| {
        let out = compile(src);
        let at = out.find("$$__view(): DocumentFragment").expect("a view");
        out[at..].to_string()
    };
    assert_eq!(view(ARROW), view(METHOD));
}
