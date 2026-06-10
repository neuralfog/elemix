//! Tests for the nested-template string scanners — balanced matching is the
//! error-prone foundation of directive lowering, so it is unit-tested directly.

use elemix_compiler::lower::{
    find_html_spans, slice, split_call_args, split_template_literal, split_ternary,
};

fn tern(s: &str) -> Option<(String, String, String)> {
    split_ternary(s)
}

#[test]
fn splits_a_plain_ternary() {
    assert_eq!(
        tern("a ? b : c"),
        Some(("a".into(), "b".into(), "c".into()))
    );
}

#[test]
fn splits_a_repeat_ternary() {
    assert_eq!(
        tern("cond ? repeat(x, f, k) : tpl`<div/>`"),
        Some(("cond".into(), "repeat(x, f, k)".into(), "tpl`<div/>`".into()))
    );
}

#[test]
fn nested_ternary_in_else_stays_whole() {
    assert_eq!(
        tern("a ? b : c ? d : e"),
        Some(("a".into(), "b".into(), "c ? d : e".into()))
    );
}

#[test]
fn optional_chaining_and_nullish_are_not_ternary_markers() {
    assert_eq!(tern("x?.y ? a : b").unwrap().0, "x?.y");
    assert_eq!(tern("x ?? y ? a : b").unwrap().0, "x ?? y");
}

#[test]
fn colons_in_object_branches_are_skipped() {
    assert_eq!(
        tern("c ? { a: 1 } : { b: 2 }"),
        Some(("c".into(), "{ a: 1 }".into(), "{ b: 2 }".into()))
    );
}

#[test]
fn non_ternary_is_none() {
    assert_eq!(tern("when(a, f)"), None);
    assert_eq!(tern("this.x.y"), None);
}

#[test]
fn splits_a_simple_template_literal() {
    let (statics, holes) = split_template_literal("tpl`<div>${x}</div>`");
    assert_eq!(statics, vec!["<div>", "</div>"]);
    assert_eq!(holes, vec!["x"]);
}

#[test]
fn splits_adjacent_holes() {
    let (statics, holes) = split_template_literal("tpl`${a}${b}`");
    assert_eq!(statics, vec!["", "", ""]);
    assert_eq!(holes, vec!["a", "b"]);
}

#[test]
fn keeps_a_nested_template_inside_a_hole_intact() {
    let (statics, holes) =
        split_template_literal("tpl`<a>${cond ? tpl`<b/>` : ''}</a>`");
    assert_eq!(statics, vec!["<a>", "</a>"]);
    assert_eq!(holes, vec!["cond ? tpl`<b/>` : ''"]);
}

#[test]
fn splits_call_args_at_top_level_only() {
    let args = split_call_args("repeat(this.x, (r) => r.id, k)");
    assert_eq!(args, vec!["this.x", "(r) => r.id", "k"]);
}

#[test]
fn call_args_ignore_commas_inside_nested_constructs() {
    let args =
        split_call_args("repeat(this.x, (r) => tpl`<a>${f(r, 1)}</a>`, (r) => r.id)");
    assert_eq!(
        args,
        vec![
            "this.x",
            "(r) => tpl`<a>${f(r, 1)}</a>`",
            "(r) => r.id",
        ]
    );
}

#[test]
fn call_args_ignore_commas_in_object_and_array_literals() {
    let args = split_call_args("choose([[a, f1], [b, f2], [true, f3]])");
    assert_eq!(args, vec!["[[a, f1], [b, f2], [true, f3]]"]);
}

#[test]
fn call_args_tolerate_a_trailing_comma() {
    let args = split_call_args("f(a, b,)");
    assert_eq!(args, vec!["a", "b"]);
}

#[test]
fn finds_two_html_spans_in_a_ternary() {
    let expr = "cond ? tpl`<a/>` : tpl`<b/>`";
    let spans = find_html_spans(expr);
    assert_eq!(spans.len(), 2);
    assert_eq!(slice(expr, spans[0].0, spans[0].1), "tpl`<a/>`");
    assert_eq!(slice(expr, spans[1].0, spans[1].1), "tpl`<b/>`");
}

#[test]
fn finds_only_the_outer_html_when_nested() {
    let expr = "tpl`<a>${inner ? tpl`<b/>` : ''}</a>`";
    let spans = find_html_spans(expr);
    assert_eq!(spans.len(), 1);
    assert_eq!(slice(expr, spans[0].0, spans[0].1), expr);
}

#[test]
fn finds_html_inside_a_repeat_render_arg() {
    let expr = "repeat(x, (r) => tpl`<li>${r.t}</li>`, (r) => r.id)";
    let spans = find_html_spans(expr);
    assert_eq!(spans.len(), 1);
    assert_eq!(slice(expr, spans[0].0, spans[0].1), "tpl`<li>${r.t}</li>`");
}

#[test]
fn ignores_the_letters_html_inside_an_identifier() {
    // `getHtml` and a member `.tpl` must not be mistaken for a tagged template
    let spans = find_html_spans("getHtml(x) + this.html");
    assert!(spans.is_empty());
}
