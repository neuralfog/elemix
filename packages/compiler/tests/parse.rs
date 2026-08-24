use elemix_compiler::template::node::{Slot, Step};
use elemix_compiler::template::parse::parse;

fn s(parts: &[&str]) -> Vec<String> {
    parts.iter().map(std::string::ToString::to_string).collect()
}

#[test]
fn sole_text_hole_bakes_a_node() {
    let r = parse(&s(&["<div>", "</div>"]), &s(&["count"]));
    assert_eq!(r.markup, "<div> </div>");
    assert_eq!(r.holes.len(), 1);
    assert_eq!(r.holes[0].slot, Slot::Text);
    assert_eq!(r.holes[0].expr, "count");
    assert_eq!(r.holes[0].path, vec![Step::Child(0), Step::ChildNode(0)]);
}

#[test]
fn top_level_hole_has_no_element_step() {
    let r = parse(&s(&["", ""]), &s(&["x"]));
    assert_eq!(r.markup, " ");
    assert_eq!(r.holes[0].slot, Slot::Text);
    assert_eq!(r.holes[0].path, vec![Step::ChildNode(0)]);
}

#[test]
fn top_level_structural_hole_keeps_its_anchor() {
    let r = parse(&s(&["", ""]), &s(&["when(c, () => x)"]));
    assert_eq!(r.markup, "<!---->");
    assert_eq!(r.holes[0].slot, Slot::Content);
    assert_eq!(r.holes[0].path, vec![Step::ChildNode(0)]);
}

#[test]
fn adjacent_holes_and_interleaved_static() {
    let r = parse(&s(&["<p>", "-", "</p>"]), &s(&["a", "b"]));
    assert_eq!(r.markup, "<p><!---->-<!----></p>");
    assert_eq!(r.holes.len(), 2);
    assert_eq!(r.holes[0].path, vec![Step::Child(0), Step::ChildNode(0)]);
    assert_eq!(r.holes[1].path, vec![Step::Child(0), Step::ChildNode(2)]);
}

#[test]
fn space_between_two_holes_is_preserved() {
    let r = parse(&s(&["<p>", " ", "</p>"]), &s(&["a", "b"]));
    assert_eq!(r.markup, "<p><!----> <!----></p>");
    assert_eq!(r.holes[0].path, vec![Step::Child(0), Step::ChildNode(0)]);
    assert_eq!(r.holes[1].path, vec![Step::Child(0), Step::ChildNode(2)]);
}

#[test]
fn nested_elements_index_correctly() {
    let r = parse(&s(&["<div><a>x</a><b>", "</b></div>"]), &s(&["y"]));
    assert_eq!(r.markup, "<div><a>x</a><b> </b></div>");
    assert_eq!(
        r.holes[0].path,
        vec![Step::Child(0), Step::Child(1), Step::ChildNode(0)]
    );
}

#[test]
fn top_level_siblings_index_correctly() {
    let r = parse(&s(&["<a></a><b>", "</b>"]), &s(&["x"]));
    assert_eq!(r.markup, "<a></a><b> </b>");
    assert_eq!(r.holes[0].path, vec![Step::Child(1), Step::ChildNode(0)]);
}

#[test]
fn void_element_counts_as_a_node() {
    let r = parse(&s(&["<p>a<br>", "</p>"]), &s(&["x"]));
    assert_eq!(r.markup, "<p>a<br/><!----></p>");
    assert_eq!(r.holes[0].path, vec![Step::Child(0), Step::ChildNode(2)]);
}

#[test]
fn source_comment_is_dropped_without_shifting_indices() {
    let r = parse(&s(&["<div><!-- note -->", "</div>"]), &s(&["x"]));
    assert_eq!(r.markup, "<div> </div>");
    assert_eq!(r.holes[0].path, vec![Step::Child(0), Step::ChildNode(0)]);
}

#[test]
fn bare_attr_is_stripped_and_bound() {
    let r = parse(&s(&["<a href=", ">x</a>"]), &s(&["u"]));
    assert_eq!(r.markup, "<a>x</a>");
    assert_eq!(r.holes.len(), 1);
    assert_eq!(r.holes[0].slot, Slot::Attr("href".into()));
    assert_eq!(r.holes[0].expr, "u");
    assert_eq!(r.holes[0].path, vec![Step::Child(0)]);
}

#[test]
fn quoted_attr_with_prefix_is_template_literal() {
    let r = parse(&s(&["<a href=\"/users/", "\">x</a>"]), &s(&["id"]));
    assert_eq!(r.markup, "<a>x</a>");
    assert_eq!(r.holes[0].slot, Slot::Attr("href".into()));
    assert_eq!(r.holes[0].expr, "`/users/${id}`");
}

#[test]
fn quoted_attr_with_prefix_and_suffix_is_template_literal() {
    let r = parse(&s(&["<a href=\"/u/", "/edit\">x</a>"]), &s(&["id"]));
    assert_eq!(r.holes[0].slot, Slot::Attr("href".into()));
    assert_eq!(r.holes[0].expr, "`/u/${id}/edit`");
}

#[test]
fn quoted_and_unquoted_single_hole_are_equivalent() {
    let bare = parse(&s(&["<a title=", ">y</a>"]), &s(&["x"]));
    let quoted = parse(&s(&["<a title=\"", "\">y</a>"]), &s(&["x"]));
    assert_eq!(bare.holes[0].slot, Slot::Attr("title".into()));
    assert_eq!(bare.holes[0].expr, "x");
    assert_eq!(quoted.holes[0].slot, bare.holes[0].slot);
    assert_eq!(quoted.holes[0].expr, bare.holes[0].expr);
    assert_eq!(quoted.holes[0].path, bare.holes[0].path);
}

#[test]
fn quoted_attr_with_multiple_holes_is_template_literal() {
    let r = parse(&s(&["<div class=\"", " ", "\">x</div>"]), &s(&["a", "b"]));
    assert_eq!(r.markup, "<div>x</div>");
    assert_eq!(r.holes[0].slot, Slot::Attr("class".into()));
    assert_eq!(r.holes[0].expr, "`${a} ${b}`");
}

#[test]
fn event_and_sigil_names_are_preserved() {
    let r = parse(&s(&["<button @click=", ">go</button>"]), &s(&["f"]));
    assert_eq!(r.markup, "<button>go</button>");
    assert_eq!(r.holes[0].slot, Slot::Attr("@click".into()));
    assert_eq!(r.holes[0].expr, "f");
}

#[test]
fn colon_and_tilde_sigils_are_preserved() {
    let r = parse(&s(&["<input :ref=", " ~onmodel=", " />"]), &s(&["r", "f"]));
    assert_eq!(r.markup, "<input/>");
    assert_eq!(r.holes.len(), 2);
    assert_eq!(r.holes[0].slot, Slot::Attr(":ref".into()));
    assert_eq!(r.holes[1].slot, Slot::Attr("~onmodel".into()));
}

#[test]
fn multiple_attr_holes_share_the_element_path() {
    let r = parse(
        &s(&["<input ~model=", " @keydown=", " />"]),
        &s(&["m", "k"]),
    );
    assert_eq!(r.markup, "<input/>");
    assert_eq!(r.holes.len(), 2);
    assert_eq!(r.holes[0].slot, Slot::Attr("~model".into()));
    assert_eq!(r.holes[1].slot, Slot::Attr("@keydown".into()));
    assert_eq!(r.holes[0].path, vec![Step::Child(0)]);
    assert_eq!(r.holes[1].path, vec![Step::Child(0)]);
}

#[test]
fn dynamic_attr_stripped_but_later_static_attr_kept() {
    let r = parse(&s(&["<a href=", " class=\"x\">y</a>"]), &s(&["u"]));
    assert_eq!(r.markup, "<a class=\"x\">y</a>");
    assert_eq!(r.holes.len(), 1);
    assert_eq!(r.holes[0].slot, Slot::Attr("href".into()));
}

#[test]
fn self_closing_custom_element_with_prop() {
    let r = parse(&s(&["<user-card :name=", " />"]), &s(&["n"]));
    assert_eq!(r.markup, "<user-card></user-card>");
    assert_eq!(r.holes[0].slot, Slot::Attr(":name".into()));
    assert_eq!(r.holes[0].path, vec![Step::Child(0)]);
}

#[test]
fn adjacent_self_closed_customs_stay_siblings() {
    let r = parse(&s(&["<signal-value /><signal-buttons />"]), &[]);
    assert_eq!(
        r.markup,
        "<signal-value></signal-value><signal-buttons></signal-buttons>"
    );
}

#[test]
fn void_self_close_stays_self_closed() {
    let r = parse(&s(&["<br /><img src=\"x\" />"]), &[]);
    assert_eq!(r.markup, "<br/><img src=\"x\"/>");
}

#[test]
fn static_attrs_are_kept_through_a_dynamic_one() {
    let r = parse(&s(&["<input type=\"text\" ~model=", " />"]), &s(&["m"]));
    assert_eq!(r.markup, "<input type=\"text\"/>");
    assert_eq!(r.holes.len(), 1);
    assert_eq!(r.holes[0].slot, Slot::Attr("~model".into()));
}

#[test]
fn single_quoted_attr_is_normalized_to_double() {
    let r = parse(&s(&["<p class='note'>x</p>"]), &[]);
    assert_eq!(r.markup, "<p class=\"note\">x</p>");
    assert!(r.holes.is_empty());
}

#[test]
fn unquoted_static_attr_value_is_requoted() {
    let r = parse(&s(&["<div id=main>x</div>"]), &[]);
    assert_eq!(r.markup, "<div id=\"main\">x</div>");
}

#[test]
fn boolean_attr_and_void_without_slash() {
    let r = parse(&s(&["<input disabled type=\"text\">"]), &[]);
    assert_eq!(r.markup, "<input disabled type=\"text\"/>");
    assert!(r.holes.is_empty());
}

#[test]
fn attr_value_internal_spaces_are_preserved() {
    let r = parse(&s(&["<svg viewBox=\"0 0 200 200\"></svg>"]), &[]);
    assert_eq!(r.markup, "<svg viewBox=\"0 0 200 200\"></svg>");
}

#[test]
fn object_literal_attr_expr_is_stored_verbatim() {
    let r = parse(
        &s(&["<tr class=", "></tr>"]),
        &s(&["{ danger: sel === id }"]),
    );
    assert_eq!(r.markup, "<tr></tr>");
    assert_eq!(r.holes[0].slot, Slot::Attr("class".into()));
    assert_eq!(r.holes[0].expr, "{ danger: sel === id }");
}

#[test]
fn multiline_content_expr_is_stored_verbatim() {
    let expr = "repeat(\n  items,\n  (i) => i,\n)";
    let r = parse(&s(&["<ul>", "</ul>"]), &s(&[expr]));
    assert_eq!(r.markup, "<ul><!----></ul>");
    assert_eq!(r.holes[0].expr, expr);
}

#[test]
fn backticks_in_attr_expr_survive() {
    let expr = "{ 'font-size': `${size}px` }";
    let r = parse(&s(&["<div style=", "></div>"]), &s(&[expr]));
    assert_eq!(r.holes[0].slot, Slot::Attr("style".into()));
    assert_eq!(r.holes[0].expr, expr);
}

#[test]
fn whitespace_between_tags_is_dropped_but_kept_at_holes() {
    let r = parse(
        &s(&["<div>\n  <span>a</span>\n  <span>b</span>\n</div>"]),
        &[],
    );
    assert_eq!(r.markup, "<div><span>a</span><span>b</span></div>");

    let r2 = parse(&s(&["<p><b>full:</b> ", "</p>"]), &s(&["name"]));
    assert_eq!(r2.markup, "<p><b>full:</b> <!----></p>");
    assert_eq!(r2.holes[0].path, vec![Step::Child(0), Step::ChildNode(2)]);
}

#[test]
fn whitespace_only_content_collapses_to_empty() {
    let r = parse(&s(&["<div>   </div>"]), &[]);
    assert_eq!(r.markup, "<div></div>");
}

#[test]
fn leading_trailing_text_is_trimmed_and_runs_collapse() {
    let r = parse(&s(&["<p>  a\n     b  </p>"]), &[]);
    assert_eq!(r.markup, "<p>a b</p>");
}
