use elemix_template_formatter::format::diagnose;
use elemix_template_formatter::{format_source, Options};
use proptest::prelude::*;

fn opts() -> Options {
    Options {
        width: 80,
        tab_width: 4,
        ..Options::default()
    }
}

const TOKENS: &[&str] = &[
    "tpl`",
    "`",
    "${",
    "}",
    "</",
    "<div>",
    "<span>",
    "<pre>",
    "</pre>",
    "<style>",
    "</style>",
    "<br/>",
    "\\",
    "\\`",
    "'",
    "\"",
    "//",
    "/*",
    "*/",
    "\n",
    "  ",
    "\t",
    "repeat(",
    ")",
    "=>",
    "this.x",
    ":prop=",
    "@click=",
    "~model=",
    "class=\"a\"",
    "text",
    "café",
    "👍",
    "日本語",
    "{ a: 1 }",
    "cond ? a : b",
];

fn token_soup() -> impl Strategy<Value = String> {
    proptest::collection::vec(
        prop_oneof![
            proptest::sample::select(TOKENS).prop_map(std::string::ToString::to_string),
            any::<char>().prop_map(|c| c.to_string()),
        ],
        0..64,
    )
    .prop_map(|parts| parts.concat())
}

fn assert_idempotent(src: &str) -> Result<(), TestCaseError> {
    let first = format_source(src, &opts());
    let second = format_source(&first.output, &opts());
    prop_assert!(
        first.output == second.output,
        "not idempotent\ninput: {:?}\nfirst: {:?}\nsecond: {:?}",
        src,
        first.output,
        second.output
    );
    Ok(())
}

const WELL_FORMED_TAGS: &[&str] = &[
    "div", "span", "p", "ul", "li", "section", "article", "b", "i", "a", "em", "strong",
];

fn well_formed_html() -> impl Strategy<Value = String> {
    let leaf = prop_oneof![
        "[a-z][a-z ]{0,7}[a-z]".prop_map(|s| s),
        Just("<br/>".to_string()),
        "[a-z]{1,5}".prop_map(|e| format!("${{{e}}}")),
    ];
    leaf.prop_recursive(4, 40, 4, |inner| {
        (
            proptest::sample::select(WELL_FORMED_TAGS),
            proptest::collection::vec(inner, 0..4),
        )
            .prop_map(|(tag, kids)| format!("<{tag}>{}</{tag}>", kids.concat()))
    })
}

fn well_formed_template() -> impl Strategy<Value = String> {
    proptest::collection::vec(well_formed_html(), 1..3)
        .prop_map(|parts| format!("tpl`{}`", parts.concat()))
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 2048, ..ProptestConfig::default() })]

    #[test]
    fn format_never_panics_on_token_soup(src in token_soup()) {
        let _ = format_source(&src, &opts());
    }

    #[test]
    fn format_never_panics_on_raw_strings(src in any::<String>()) {
        let _ = format_source(&src, &opts());
    }

    #[test]
    fn diagnose_never_panics_on_token_soup(src in token_soup()) {
        let _ = diagnose(&src, &opts());
    }

    #[test]
    fn diagnose_never_panics_on_raw_strings(src in any::<String>()) {
        let _ = diagnose(&src, &opts());
    }

    #[test]
    fn idempotent_on_well_formed_templates(src in well_formed_template()) {
        assert_idempotent(&src)?;
    }
}

#[test]
fn stray_close_tag_is_preserved_and_idempotent() {
    let src = "tpl`a</span>b`";
    let out = format_source(src, &opts()).output;
    assert!(
        out.contains("</span>"),
        "stray close tag must not be dropped: {out:?}"
    );
    let again = format_source(&out, &opts()).output;
    assert_eq!(out, again, "stray close tag output must be a fixed point");
}
