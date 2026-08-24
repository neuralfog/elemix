use elemix_compiler::{
    compile, compile_diagnostics, compile_diagnostics_mode, compile_hydrate, compile_ssr,
    scan_components, scan_element_uses, scan_hints, scan_imports, scan_match_sites, scan_props,
    scan_special_bindings,
};
use proptest::prelude::*;

fn exercise(source: &str) {
    let _ = compile(source);
    let _ = compile_diagnostics(source);
    let _ = compile_diagnostics_mode(source, false, false, false);
    let _ = compile_diagnostics_mode(source, true, false, false);
    let _ = compile_diagnostics_mode(source, false, true, false);
    let _ = compile_diagnostics_mode(source, true, false, true);
    let _ = compile_ssr(source, false);
    let _ = compile_ssr(source, true);
    let _ = compile_hydrate(source, false);
    let _ = compile_hydrate(source, true);
    let _ = scan_components(source);
    let _ = scan_element_uses(source);
    let _ = scan_hints(source);
    let _ = scan_imports(source);
    let _ = scan_match_sites(source);
    let _ = scan_props(source);
    let _ = scan_special_bindings(source);
}

const TOKENS: &[&str] = &[
    "tpl`",
    "html`",
    "`",
    "${",
    "}",
    "// #component",
    "// #tag my-el",
    "// #state",
    "// #styles",
    "// #store name",
    "// #form",
    "// #effect",
    "class X extends Component {",
    "class X extends Component<Props> {",
    "export class Y extends Component {",
    "@click=",
    "@input=",
    ":prop=",
    ":name=",
    "~model=",
    "#model=",
    "ref=",
    "</",
    "<my-el>",
    "<my-el />",
    "<div class=\"row\">",
    "</div>",
    "match(",
    "repeat(",
    "styles = css;",
    "state: State = { count: 0 };",
    "this.state.count",
    "import { Component, tpl } from '@neuralfog/elemix';",
    "\n",
    " ",
    "\t",
    "\"",
    "'",
    "\\",
    "()=>",
    "=>",
    "😀",
    "café",
    "日本語",
    "\u{200d}",
    "\u{0}",
];

fn token_soup() -> impl Strategy<Value = String> {
    let atom = prop_oneof![
        prop::sample::select(TOKENS).prop_map(str::to_string),
        any::<char>().prop_map(|c| c.to_string()),
    ];
    prop::collection::vec(atom, 0..64).prop_map(|parts| parts.concat())
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 2048, ..ProptestConfig::default() })]

    #[test]
    fn no_panic_on_token_soup(source in token_soup()) {
        exercise(&source);
    }

    #[test]
    fn no_panic_on_random_string(source in ".{0,512}") {
        exercise(&source);
    }

    #[test]
    fn no_panic_on_arbitrary_unicode(source in "\\PC{0,256}") {
        exercise(&source);
    }
}
