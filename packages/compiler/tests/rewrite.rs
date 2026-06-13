//! Rewrite import-hygiene tests — the compile-time `tpl` tag and the erased
//! `repeat`/`when`/`choose` directives leave no trace in the emitted imports.

use elemix_compiler::compile;

const COUNTER: &str = r#"import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
export class CounterApp extends Component {
    state = state({ count: 0 });
    template = (): Template => tpl`<button @click=${this.inc}>${this.state.count}</button>`;
}
defineComponent('counter-app', CounterApp);
"#;

const WITH_REPEAT: &str = r#"import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
export class ListApp extends Component {
    state = state({ rows: [] as { id: number }[] });
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
