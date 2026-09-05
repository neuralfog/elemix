pub mod codegen;
pub mod diagnostics;
pub mod emit;
pub mod free_template;
pub mod grammar;
pub mod imports;
mod locate;
pub mod lower;
pub mod optimise;
pub mod pragma;
pub mod rewrite;
pub mod scan;
#[cfg(feature = "cli")]
pub mod sourcemap;
pub mod splice;
pub mod ssr;
pub mod ssr_expr;
pub mod ssr_style;
pub mod template;
#[cfg(feature = "wasm")]
pub mod wasm;

pub use diagnostics::Diagnostic;
#[cfg(feature = "cli")]
pub use locate::collect_ts_files;
pub use locate::{find_html_templates, FoundTemplate};
pub use scan::{
    scan_components, scan_element_uses, scan_hints, scan_imports, scan_match_sites, scan_props,
    scan_special_bindings, ComponentDecl, ElementUse, HintDiagnostic, HintKind, HintSeverity,
    Import, MatchSite, PropSite, SpecialBinding, SpecialKind,
};

pub fn compile(source: &str) -> String {
    compile_diagnostics(source).0
}

pub fn compile_diagnostics(source: &str) -> (String, Vec<Diagnostic>) {
    compile_diagnostics_mode(source, false, false, false)
}

pub fn compile_diagnostics_mode(
    source: &str,
    ssr: bool,
    hydrate: bool,
    minify: bool,
) -> (String, Vec<Diagnostic>) {
    let spliced = splice::inline_helpers(source);
    let diags = pragma::diagnose::collect(&spliced);
    let expanded = pragma::expand_mode(&spliced, ssr, hydrate, minify).unwrap_or(spliced);
    let lowered = free_template::lower(&rewrite::rewrite(&expanded, ssr), ssr);
    let compiled = imports::merge_runtime_imports(&lowered);
    let out = diagnostics::inline(&compiled, &diags);
    (out, diags)
}

pub fn compile_ssr(source: &str, minify: bool) -> (String, Vec<Diagnostic>) {
    let spliced = splice::inline_helpers(source);
    let source = spliced.as_str();
    let comps = rewrite::plan_components(source);
    let registered = scan_components(source);
    let located = pragma::locate::locate(source).ok();

    let mut inserts: Vec<(usize, String)> = Vec::new();
    for comp in &comps {
        let Some(decl) = registered.iter().find(|d| d.class == comp.class_name) else {
            continue;
        };
        let (no_shadow, client, document, css_value) = located
            .as_ref()
            .and_then(|l| l.classes.iter().find(|c| c.name == comp.class_name))
            .map_or((false, false, false, None), |c| {
                let meta = pragma::resolve(&c.directives).ok();
                let no_shadow = meta.as_ref().is_some_and(|m| m.no_shadow);
                let client = meta.as_ref().is_some_and(|m| m.client);
                let document = meta.as_ref().is_some_and(|m| m.document);
                let css = c.styles.first().map(|s| s.value.clone());
                (no_shadow, client, document, css)
            });

        let style_body = css_value.as_ref().map(|expr| {
            if minify {
                if let Some(css) = ssr_style::resolve_css(expr, source) {
                    return template::parse::esc_tpl(&ssr_style::minify_css(&css));
                }
            }
            format!("${{{expr}}}")
        });

        let inner = template::parse::ssr_inner(&comp.statics, &comp.holes);
        let method = ssr::ssr_method(
            &decl.tag,
            style_body.as_deref(),
            no_shadow,
            client,
            document,
            &comp.prelude,
            inner,
        );
        inserts.push((comp.body_open, format!("\n{method}\n")));
    }

    let injected = apply_inserts(source, inserts);

    let (out, diags) = compile_diagnostics_mode(&injected, true, false, minify);
    (imports::add_ssr_runtime_import(&out), diags)
}

pub fn compile_hydrate(source: &str, minify: bool) -> (String, Vec<Diagnostic>) {
    let spliced = splice::inline_helpers(source);
    let source = spliced.as_str();
    let comps = rewrite::plan_components(source);
    let emitter = emit::TsEmitter::new();

    let mut inserts: Vec<(usize, String)> = Vec::new();
    let mut decls = String::new();
    for comp in &comps {
        let gen = codegen::generate_hydrate(&comp.statics, &comp.holes, &emitter);
        decls.push_str(&gen.decls);
        let prelude = if comp.prelude.is_empty() {
            String::new()
        } else {
            format!("{}\n", comp.prelude)
        };
        let method = format!("$$__hydrate(root: Node): void {{\n{prelude}{}}}", gen.body);
        inserts.push((comp.body_open, format!("\n{method}\n")));
    }

    let mut injected = apply_inserts(source, inserts);
    if !decls.is_empty() {
        injected = format!("{decls}\n{injected}");
    }

    let (out, diags) = compile_diagnostics_mode(&injected, false, true, minify);
    (imports::add_hydrate_runtime_import(&out), diags)
}

fn apply_inserts(source: &str, mut inserts: Vec<(usize, String)>) -> String {
    inserts.sort_by_key(|(at, _)| std::cmp::Reverse(*at));
    let mut injected = source.to_string();
    for (at, text) in inserts {
        injected.insert_str(at, &text);
    }
    injected
}

#[cfg(feature = "cli")]
pub fn compile_with_map(source: &str, source_name: &str) -> (String, String) {
    let code = compile(source);
    let map = sourcemap::line_map(source, &code, source_name);
    (code, map)
}
