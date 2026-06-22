//! Stage 3 grammar tests — classify holes into bindings. Attribute holes are
//! exact (sigil/reserved-name); content holes classify by value-shape.

use elemix_compiler::grammar::{classify, BindingKind};
use elemix_compiler::template::node::{Hole, Slot, Step};
use oxc_span::Span;

fn attr(name: &str, expr: &str) -> Hole {
    Hole {
        path: vec![Step::Child(0)],
        slot: Slot::Attr(name.into()),
        expr: expr.into(),
        span: Span::default(),
        tag: None,
    }
}

fn content(expr: &str) -> Hole {
    Hole {
        path: vec![Step::ChildNode(0)],
        slot: Slot::Content,
        expr: expr.into(),
        span: Span::default(),
        tag: None,
    }
}

// ---------------------------------------------------------------------------
// attribute sigils
// ---------------------------------------------------------------------------

#[test]
fn event_strips_at_and_keeps_name() {
    let b = classify(&attr("@click", "this.go"));
    assert_eq!(b.kind, BindingKind::Event);
    assert_eq!(b.name.as_deref(), Some("click"));
    assert_eq!(b.expr, "this.go");
}

#[test]
fn prop_strips_colon_and_keeps_name() {
    let b = classify(&attr(":counter", "this.state.counter"));
    assert_eq!(b.kind, BindingKind::Prop);
    assert_eq!(b.name.as_deref(), Some("counter"));
}

#[test]
fn ref_is_distinct_from_prop() {
    let b = classify(&attr(":ref", "this.input"));
    assert_eq!(b.kind, BindingKind::Ref);
    assert_eq!(b.name, None);
}

#[test]
fn model_and_onmodel() {
    assert_eq!(classify(&attr("~model", "x")).kind, BindingKind::Model);
    assert_eq!(classify(&attr("~onmodel", "f")).kind, BindingKind::OnModel);
    assert_eq!(classify(&attr("~model", "x")).name, None);
}

#[test]
fn class_and_style_are_reserved_names() {
    assert_eq!(
        classify(&attr("class", "{ on: x }")).kind,
        BindingKind::Class
    );
    assert_eq!(
        classify(&attr("style", "{ color: c }")).kind,
        BindingKind::Style
    );
    assert_eq!(classify(&attr("class", "{}")).name, None);
}

#[test]
fn bare_attr_keeps_full_name() {
    let b = classify(&attr("href", "u"));
    assert_eq!(b.kind, BindingKind::Attr);
    assert_eq!(b.name.as_deref(), Some("href"));

    assert_eq!(
        classify(&attr("data-count", "n")).name.as_deref(),
        Some("data-count")
    );
    assert_eq!(classify(&attr("hidden", "c")).kind, BindingKind::Attr);
}

#[test]
fn path_and_expr_pass_through() {
    let b = classify(&attr("href", "`/u/${id}`"));
    assert_eq!(b.path, vec![Step::Child(0)]);
    assert_eq!(b.expr, "`/u/${id}`");
}

// ---------------------------------------------------------------------------
// content value-shape
// ---------------------------------------------------------------------------

#[test]
fn plain_value_is_text() {
    assert_eq!(
        classify(&content("this.state.count")).kind,
        BindingKind::Text
    );
    assert_eq!(classify(&content("row.label")).kind, BindingKind::Text);
    assert_eq!(classify(&content("this.state.n")).kind, BindingKind::Text);
}

#[test]
fn value_ternary_is_text() {
    // branches are strings, not templates → still text
    let b = classify(&content("this.user.online ? 'online' : 'offline'"));
    assert_eq!(b.kind, BindingKind::Text);
}

#[test]
fn repeat_is_list() {
    let b = classify(&content("repeat(\n  this.state.rows,\n  (r) => r,\n)"));
    assert_eq!(b.kind, BindingKind::List);
    assert_eq!(b.name, None);
}

#[test]
fn when_and_choose_are_child() {
    assert_eq!(
        classify(&content("when(this.x, () => tpl`<i></i>`)")).kind,
        BindingKind::Child
    );
    assert_eq!(
        classify(&content("choose([[this.a, () => tpl`<i></i>`]])")).kind,
        BindingKind::Child
    );
}

#[test]
fn template_ternary_is_child() {
    let b = classify(&content(
        "this.state.loggedIn ? tpl`<a></a>` : tpl`<b></b>`",
    ));
    assert_eq!(b.kind, BindingKind::Child);
}

#[test]
fn single_branch_template_ternary_is_child() {
    let b = classify(&content("this.state.width ? tpl`<div></div>` : ''"));
    assert_eq!(b.kind, BindingKind::Child);
}

#[test]
fn html_substring_in_an_identifier_is_not_a_template() {
    // a member access that merely contains the letters "html" must stay Text
    assert_eq!(classify(&content("this.htmlLabel")).kind, BindingKind::Text);
    assert_eq!(classify(&content("getHtml(x)")).kind, BindingKind::Text);
}

#[test]
fn bare_identifier_is_text_pending_splice_resolution() {
    // KNOWN GAP: `${header}` where `const header = tpl`...`` should be Splice,
    // but that is indistinguishable from a text value without symbol
    // resolution. Until the sub-template wiring pass lands it falls to Text.
    assert_eq!(classify(&content("header")).kind, BindingKind::Text);
    assert_eq!(
        classify(&content("this.headerTemplate()")).kind,
        BindingKind::Text
    );
}
