use elemix_compiler::codegen::codegen;
use elemix_compiler::emit::TsEmitter;

fn gen(statics: &[&str], holes: &[&str]) -> String {
    let st: Vec<String> = statics
        .iter()
        .map(std::string::ToString::to_string)
        .collect();
    let ho: Vec<String> = holes.iter().map(std::string::ToString::to_string).collect();
    codegen(&st, &ho, &TsEmitter::new())
}

#[test]
fn declares_template_clones_and_returns_root() {
    let out = gen(&["<div>x</div>"], &[]);
    assert!(out.contains("const _t0 = $__template('<div>x</div>');"));
    assert!(out.contains("const _r0 = $__clone(_t0);"));
    assert!(out.trim_end().ends_with("return _r0;"));
}

#[test]
fn markup_is_escaped_as_a_js_string() {
    let out = gen(&["<p>can't</p>"], &[]);
    assert!(out.contains("$__template('<p>can\\'t</p>');"));
}

#[test]
fn nested_path_renders_member_accessors() {
    let out = gen(&["<div><span><b>", "</b></span></div>"], &["x"]);
    assert!(out.contains(".firstChild!.firstChild!.firstChild!.firstChild!;"));
}

#[test]
fn text_bakes_a_node_for_a_sole_content_hole() {
    let out = gen(&["<div>", "</div>"], &["this.state.count"]);
    assert!(out.contains("$__template('<div> </div>')"));
    assert!(!out.contains("document.createTextNode('');"));
    assert!(!out.contains(".replaceWith("));
    assert!(out.contains("$__setText("));
    assert!(out.contains("(this.state.count));"));
}

#[test]
fn text_swaps_anchor_when_not_a_sole_hole() {
    let out = gen(&["<div>n: ", "</div>"], &["this.state.count"]);
    assert!(out.contains("<!---->"));
    assert!(out.contains("document.createTextNode('');"));
    assert!(out.contains(".replaceWith("));
    assert!(out.contains("$__setText("));
}

#[test]
fn attr_template_literal_is_reactive() {
    let out = gen(&["<a href=\"/users/", "\">x</a>"], &["this.state.userId"]);
    assert!(out.contains("$__setAttr(_n1, 'href', (`/users/${this.state.userId}`));"));
}

#[test]
fn class_object_literal_is_parenthesized() {
    let out = gen(&["<tr class=", "></tr>"], &["{ danger: x }"]);
    assert!(out.contains("$__setClass(_n1, "));
    assert!(out.contains("({ danger: x }));"));
}

#[test]
fn style_casts_to_html_element() {
    let out = gen(&["<div style=", "></div>"], &["{ color: c }"]);
    assert!(out.contains("$__setStyle(_n1 as HTMLElement, ({ color: c }));"));
}

#[test]
fn prop_keeps_name_and_thunk() {
    let out = gen(&["<x :counter=", " />"], &["this.c"]);
    assert!(out.contains("$__setProp(_n1, 'counter', (this.c));"));
}

#[test]
fn model_casts_and_thunks() {
    let out = gen(&["<input ~model=", " />"], &["this.r"]);
    assert!(out.contains("$__model(_n1 as HTMLInputElement, () => (this.r));"));
}

#[test]
fn event_handler_is_raw() {
    let out = gen(&["<button @click=", ">go</button>"], &["this.go"]);
    assert!(out.contains("$__event(_n1, 'click', this.go);"));
    assert!(!out.contains("() => this.go"));
}

#[test]
fn onmodel_is_raw_and_cast() {
    let out = gen(
        &["<input ~model=", " ~onmodel=", " />"],
        &["this.r", "clamp"],
    );
    assert!(out.contains("$__onmodel(_n1 as HTMLInputElement, clamp);"));
}

#[test]
fn ref_is_raw() {
    let out = gen(&["<input :ref=", " />"], &["this.input"]);
    assert!(out.contains("$__ref(_n1, this.input);"));
}

#[test]
fn bindings_on_one_element_grab_it_once() {
    let out = gen(&["<a href=", " @click=", ">x</a>"], &["u", "this.go"]);
    assert_eq!(out.matches("= _r0.firstChild!;").count(), 1);
    assert!(out.contains("$__setAttr(_n1, 'href', (u));"));
    assert!(out.contains("$__event(_n1, 'click', this.go);"));
}

#[test]
fn repeat_lowers_to_list_with_an_iife_builder() {
    let out = gen(
        &["<ul>", "</ul>"],
        &["repeat(this.rows, (r) => tpl`<li>${r.t}</li>`, (r) => r.id)"],
    );
    assert!(out.contains("const _t1 = $__templateEl('<li> </li>');"));
    assert!(out.contains("$__list(_n1, () => (this.rows), (r) => r.id, (r) => (() => {"));
    assert!(out.contains("$__cloneEl(_t1)"));
    assert!(out.contains("$__setText("));
    assert!(out.contains("(r.t));"));
}

#[test]
fn nested_repeat_recurses() {
    let out = gen(
        &["<ul>", "</ul>"],
        &["repeat(cats, (c) => tpl`<li>${repeat(c.items, (i) => tpl`<b>${i.n}</b>`, (i) => i.id)}</li>`, (c) => c.id)"],
    );
    assert!(out.contains("const _t0 = $__template("));
    assert!(out.contains("const _t1 = $__templateEl("));
    assert!(out.contains("const _t2 = $__templateEl("));
    assert_eq!(out.matches("$__list(").count(), 2);
    assert!(out.contains("() => (cats)"));
    assert!(out.contains("() => (c.items)"));
}

#[test]
fn template_ternary_lowers_to_child() {
    let out = gen(&["<div>", "</div>"], &["c ? tpl`<a></a>` : tpl`<b></b>`"]);
    assert!(out.contains("$__child(_n1, () => (c"));
    assert!(out.contains("? (() => {"));
    assert!(out.contains("$__cloneEl(_t1)"));
    assert!(out.contains("$__cloneEl(_t2)"));
}

#[test]
fn multi_root_child_branch_returns_the_whole_fragment() {
    let out = gen(&["<div>", "</div>"], &["c ? tpl`<a></a><b></b>` : ''"]);
    assert!(out.contains("$__clone(_t1)"));
    assert!(out.contains("return _r2;"));
    assert!(!out.contains("_r2.firstChild!"));
}

#[test]
fn multi_root_list_row_returns_the_whole_fragment() {
    let out = gen(
        &["<div>", "</div>"],
        &["repeat(items, (e) => tpl`<a></a><b></b>`, (e) => e.id)"],
    );
    assert!(out.contains("$__list("));
    assert!(out.contains("return _r2;"));
    assert!(!out.contains("_r2.firstChild!"));
}

#[test]
fn ternary_with_empty_branch_is_preserved() {
    let out = gen(&["<div>", "</div>"], &["c ? tpl`<a></a>` : ''"]);
    assert!(out.contains("$__child(_n1, () => (c"));
    assert!(out.trim_end().contains(": ''));"));
}

#[test]
fn when_lowers_to_child_without_a_double_iife() {
    let out = gen(
        &["<div>", "</div>"],
        &["when(this.show, () => tpl`<a></a>`)"],
    );
    assert!(out.contains("$__child(_n1, () => (this.show ? (() => {"));
    assert!(out.contains(": ''));"));
    assert!(!out.contains("(() => (() =>"));
}

#[test]
fn repeat_in_a_ternary_becomes_list_plus_child() {
    let out = gen(
        &["<div>", "</div>"],
        &["log.len ? repeat(items, (e) => tpl`<li>${e.t}</li>`, (e) => e.id) : tpl`<p>empty</p>`"],
    );
    assert!(out.contains("document.createComment('')"));
    assert!(out.contains(".before("));
    assert!(out.contains("$__list("));
    assert!(out.contains("log.len ? items : []"));
    assert!(out.contains("$__child("));
    assert!(out.contains("log.len ? '' : "));
    assert!(!out.contains("repeat("));
}

#[test]
fn choose_lowers_to_a_ternary_chain() {
    let out = gen(
        &["<div>", "</div>"],
        &["choose([[a, () => tpl`<x></x>`], [true, () => tpl`<y></y>`]])"],
    );
    assert!(out.contains("$__child(_n1, () => (a ? (() => {"));
    assert!(out.contains("true ? (() => {"));
    assert!(out.contains(": ''));"));
    assert!(!out.contains("(() => (() =>"));
}

#[test]
fn match_form1_lowers_to_an_equality_chain() {
    let out = gen(
        &["<div>", "</div>"],
        &["match(this.s, { idle: () => tpl`<x></x>`, busy: () => tpl`<y></y>` })"],
    );
    assert!(out.contains("$__child(_n1, () => (this.s === 'idle' ? (() => {"));
    assert!(out.contains("this.s === 'busy' ? (() => {"));
    assert!(out.contains(": ''));"));
}

#[test]
fn match_form1_quotes_computed_and_passes_string_keys() {
    let out = gen(
        &["<div>", "</div>"],
        &["match(this.c, { [Color.Red]: () => tpl`<x></x>`, 'lit': () => tpl`<y></y>` })"],
    );
    assert!(out.contains("this.c === (Color.Red) ?"));
    assert!(out.contains("this.c === 'lit' ?"));
}

#[test]
fn match_form2_dispatches_on_key_and_binds_the_member() {
    let out = gen(
        &["<div>", "</div>"],
        &["match(this.load, 'k', { idle: () => tpl`<x></x>`, busy: (m) => tpl`<y>${m.pct}</y>` })"],
    );
    assert!(out.contains("(this.load)['k'] === 'idle' ?"));
    assert!(out.contains("(this.load)['k'] === 'busy' ?"));
    assert!(out.contains(")(this.load)"));
}
