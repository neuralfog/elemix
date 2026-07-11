//! Rewrite import-hygiene tests — the compile-time `tpl` tag and the erased
//! `repeat`/`when`/`choose` directives leave no trace in the emitted imports.

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
    // the surviving names stay, `tpl` is gone from the import...
    assert!(out.contains("import { Component, defineComponent, state } from '@neuralfog/elemix';"));
    // ...and the tag itself is erased, so `tpl` appears nowhere.
    assert!(!out.contains("tpl"));
}

#[test]
fn directives_import_is_dropped() {
    let out = compile(WITH_REPEAT);
    assert!(!out.contains("@neuralfog/elemix/directives"));
    assert!(!out.contains("repeat("));
    // the main-barrel names survive, `tpl` does not.
    assert!(out.contains("import { Component, defineComponent, state } from '@neuralfog/elemix';"));
    assert!(!out.contains("tpl"));
}

#[test]
fn main_import_is_dropped_when_only_tpl_remained() {
    let out = compile(ONLY_TPL);
    // nothing else came from the main barrel → the whole line is removed...
    assert!(!out.contains("from '@neuralfog/elemix';"));
    // ...but the generated runtime import is still there.
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
    // both templates lowered, no tpl tag bleeds through
    assert_eq!(out.matches("$$__view(): DocumentFragment").count(), 2);
    assert!(!out.contains("tpl`"));
    // their hoisted template consts are unique (no _t0/_t0 collision)
    assert!(out.contains("const _t0 = $__template("));
    assert!(out.contains("const _t1 = $__template("));
}

#[test]
fn block_body_prelude_survives_into_view() {
    // The statements before `return tpl` (here a destructure the holes use) must
    // be carried into view() — otherwise `inc` is undefined in the emitted code.
    let out = compile(BLOCK_BODY);
    assert!(out.contains("$$__view(): DocumentFragment {"));
    assert!(out.contains("const { inc } = this;"));
    // and it lands inside view(), before the clone — not left in dead template().
    let view_at = out.find("$$__view(): DocumentFragment").unwrap();
    let destruct_at = out.find("const { inc } = this;").unwrap();
    let clone_at = out.find("$__clone(").unwrap();
    assert!(view_at < destruct_at && destruct_at < clone_at);
    assert!(!out.contains("tpl`"));
}

// --- method-form `template()` lowers like the arrow field ---

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
    // `template() { return tpl`…`; }` must lower like `template = () => tpl`…``:
    // the method signature is replaced by `view()` and the `tpl` tag is erased.
    let out = compile(METHOD_FORM);
    assert_eq!(out.matches("$$__view(): DocumentFragment").count(), 1);
    assert!(!out.contains("template(): Template"));
    assert!(!out.contains("tpl`"));
    // the holes still bound — proof the template was actually compiled
    assert!(out.contains("$__event("));
}

#[test]
fn method_form_prelude_survives_into_view() {
    // Same block-body prelude guarantee as the arrow form, but for a method.
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
    // A `get` accessor must not be mistaken for the template, and is left intact
    // (mirrors real components that pair a getter with a method template).
    let out = compile(METHOD_WITH_GETTER);
    assert!(out.contains("$$__view(): DocumentFragment {"));
    assert!(out.contains("get cls(): string"));
    assert!(!out.contains("tpl`"));
}

#[test]
fn method_and_arrow_forms_lower_identically() {
    // The two authoring forms of the same template must produce the byte-identical
    // `view()` (and everything after it).
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
