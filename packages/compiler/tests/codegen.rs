//! Stage 4 codegen tests — drive the public `codegen(statics, holes, emitter)`
//! pipeline and assert the emitted TypeScript, including nested-template lowering
//! (repeat → _list, when/choose/ternary → _child).

use elemix_compiler::codegen::codegen;
use elemix_compiler::emit::TsEmitter;

fn gen(statics: &[&str], holes: &[&str]) -> String {
    let st: Vec<String> = statics.iter().map(|s| s.to_string()).collect();
    let ho: Vec<String> = holes.iter().map(|s| s.to_string()).collect();
    codegen(&st, &ho, &TsEmitter::new())
}

// ---------------------------------------------------------------------------
// scaffolding
// ---------------------------------------------------------------------------

#[test]
fn declares_template_clones_and_returns_root() {
    let out = gen(&["<div>x</div>"], &[]);
    assert!(out.contains("const _t0 = template('<div>x</div>');"));
    assert!(out.contains("const _r0 = clone(_t0);"));
    assert!(out.trim_end().ends_with("return _r0;"));
}

#[test]
fn markup_is_escaped_as_a_js_string() {
    let out = gen(&["<p>can't</p>"], &[]);
    assert!(out.contains("template('<p>can\\'t</p>');"));
}

#[test]
fn nested_path_renders_member_accessors() {
    let out = gen(&["<div><span><b>", "</b></span></div>"], &["x"]);
    // div > span > b > anchor
    assert!(out.contains(".children[0].children[0].children[0].childNodes[0];"));
}

// ---------------------------------------------------------------------------
// value bindings — wrapped in a reactive `() => (...)` thunk
// ---------------------------------------------------------------------------

#[test]
fn text_replaces_anchor_with_a_text_node() {
    let out = gen(&["<div>", "</div>"], &["this.state.count"]);
    assert!(out.contains("document.createTextNode('');"));
    assert!(out.contains(".replaceWith("));
    assert!(out.contains("() => (this.state.count));"));
}

#[test]
fn attr_template_literal_is_reactive() {
    let out = gen(&["<a href=\"/users/", "\">x</a>"], &["this.state.userId"]);
    assert!(out.contains("'href', () => (`/users/${this.state.userId}`));"));
}

#[test]
fn class_object_literal_is_parenthesized() {
    let out = gen(&["<tr class=", "></tr>"], &["{ danger: x }"]);
    assert!(out.contains("_class(_n1, () => ({ danger: x }));"));
}

#[test]
fn style_casts_to_html_element() {
    let out = gen(&["<div style=", "></div>"], &["{ color: c }"]);
    assert!(out.contains("_style(_n1 as HTMLElement, () => ({ color: c }));"));
}

#[test]
fn prop_keeps_name_and_thunk() {
    let out = gen(&["<x :counter=", " />"], &["this.c"]);
    assert!(out.contains("_prop(_n1, 'counter', () => (this.c));"));
}

#[test]
fn model_casts_and_thunks() {
    let out = gen(&["<input ~model=", " />"], &["this.r"]);
    assert!(out.contains("_model(_n1 as HTMLInputElement, () => (this.r));"));
}

// ---------------------------------------------------------------------------
// function / ref bindings — passed raw, no thunk
// ---------------------------------------------------------------------------

#[test]
fn event_handler_is_raw() {
    let out = gen(&["<button @click=", ">go</button>"], &["this.go"]);
    assert!(out.contains("_event(_n1, 'click', this.go);"));
    assert!(!out.contains("() => this.go"));
}

#[test]
fn onmodel_is_raw_and_cast() {
    let out = gen(
        &["<input ~model=", " ~onmodel=", " />"],
        &["this.r", "clamp"],
    );
    assert!(out.contains("_onmodel(_n1 as HTMLInputElement, clamp);"));
}

#[test]
fn ref_is_raw() {
    let out = gen(&["<input :ref=", " />"], &["this.input"]);
    assert!(out.contains("_ref(_n1, this.input);"));
}

// ---------------------------------------------------------------------------
// node grabbing
// ---------------------------------------------------------------------------

#[test]
fn bindings_on_one_element_grab_it_once() {
    let out = gen(&["<a href=", " @click=", ">x</a>"], &["u", "this.go"]);
    assert_eq!(out.matches("= _r0.children[0];").count(), 1);
    assert!(out.contains("_attr(_n1, 'href', () => (u));"));
    assert!(out.contains("_event(_n1, 'click', this.go);"));
}

// ---------------------------------------------------------------------------
// nested templates — repeat → _list
// ---------------------------------------------------------------------------

#[test]
fn repeat_lowers_to_list_with_an_iife_builder() {
    let out = gen(
        &["<ul>", "</ul>"],
        &["repeat(this.rows, (r) => tpl`<li>${r.t}</li>`, (r) => r.id)"],
    );
    // the row template is hoisted to module scope
    assert!(out.contains("const _t1 = template('<li><!----></li>');"));
    // args reordered: _list(anchor, () => (items), key, render)
    assert!(out.contains("_list(_n1, () => (this.rows), (r) => r.id, (r) => (() => {"));
    // the builder clones the row template, binds, and returns its first node
    assert!(out.contains("clone(_t1)"));
    assert!(out.contains("() => (r.t));"));
    assert!(out.contains(".firstChild!;"));
}

#[test]
fn nested_repeat_recurses() {
    let out = gen(
        &["<ul>", "</ul>"],
        &["repeat(cats, (c) => tpl`<li>${repeat(c.items, (i) => tpl`<b>${i.n}</b>`, (i) => i.id)}</li>`, (c) => c.id)"],
    );
    assert!(out.contains("const _t0 = template("));
    assert!(out.contains("const _t1 = template("));
    assert!(out.contains("const _t2 = template("));
    // two list calls, one nested inside the other's builder
    assert_eq!(out.matches("_list(").count(), 2);
    assert!(out.contains("() => (cats)"));
    assert!(out.contains("() => (c.items)"));
}

// ---------------------------------------------------------------------------
// nested templates — when / choose / ternary → _child
// ---------------------------------------------------------------------------

#[test]
fn template_ternary_lowers_to_child() {
    let out = gen(&["<div>", "</div>"], &["c ? tpl`<a></a>` : tpl`<b></b>`"]);
    assert!(out.contains("_child(_n1, () => (c"));
    assert!(out.contains("? (() => {"));
    assert!(out.contains("clone(_t1)"));
    assert!(out.contains("clone(_t2)"));
}

#[test]
fn ternary_with_empty_branch_is_preserved() {
    let out = gen(&["<div>", "</div>"], &["c ? tpl`<a></a>` : ''"]);
    assert!(out.contains("_child(_n1, () => (c"));
    assert!(out.trim_end().contains(": ''));"));
}

#[test]
fn when_lowers_to_child_without_a_double_iife() {
    let out = gen(
        &["<div>", "</div>"],
        &["when(this.show, () => tpl`<a></a>`)"],
    );
    assert!(out.contains("_child(_n1, () => (this.show ? (() => {"));
    assert!(out.contains(": ''));"));
    assert!(!out.contains("(() => (() =>"));
}

#[test]
fn repeat_in_a_ternary_becomes_list_plus_child() {
    let out = gen(
        &["<div>", "</div>"],
        &["log.len ? repeat(items, (e) => tpl`<li>${e.t}</li>`, (e) => e.id) : tpl`<p>empty</p>`"],
    );
    // a second anchor for the list, next to the child anchor
    assert!(out.contains("document.createComment('')"));
    assert!(out.contains(".before("));
    // keyed list, guarded by the condition
    assert!(out.contains("_list("));
    assert!(out.contains("log.len ? items : []"));
    // child for the else branch
    assert!(out.contains("_child("));
    assert!(out.contains("log.len ? '' : "));
    // the repeat call itself is erased
    assert!(!out.contains("repeat("));
}

#[test]
fn choose_lowers_to_a_ternary_chain() {
    let out = gen(
        &["<div>", "</div>"],
        &["choose([[a, () => tpl`<x></x>`], [true, () => tpl`<y></y>`]])"],
    );
    assert!(out.contains("_child(_n1, () => (a ? (() => {"));
    assert!(out.contains("true ? (() => {"));
    assert!(out.contains(": ''));"));
    assert!(!out.contains("(() => (() =>"));
}
