//! elemix compiler — a transform that lowers `` tpl`...` `` templates into
//! compiled `view()` methods targeting `@neuralfog/elemix/runtime`.
//!
//! Pipeline: locate → parse → classify → codegen → rewrite. See ARCHITECTURE.md.

pub mod codegen;
pub mod diagnostics;
pub mod emit;
pub mod free_template;
pub mod grammar;
pub mod imports;
mod locate;
pub mod lower;
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

/// Compile one source file: inline helper templates (Splice), expand `#`-pragma
/// blocks (component registration + styles), then rewrite the `template` member
/// into a compiled `view()`, hoisting the `template(...)` consts and wiring the
/// runtime import.
///
/// Any diagnostics are inlined into the output — errors as a module-scope
/// `throw`, warnings as `console.warn` — so the compiler never panics and the
/// in-browser playground stays alive (it compiles per keystroke). Callers that
/// want to fail the build instead use [`compile_diagnostics`].
pub fn compile(source: &str) -> String {
    compile_diagnostics(source).0
}

/// Like [`compile`], but also returns the diagnostics it inlined so a build
/// front-end can report them (and fail fast on errors).
pub fn compile_diagnostics(source: &str) -> (String, Vec<Diagnostic>) {
    compile_diagnostics_mode(source, false, false, false)
}

/// The shared CSR pipeline, with `ssr` selecting how free `tpl` templates lower:
/// `false` (CSR / `--hydrate`) → DOM-cloning IIFEs; `true` (the `--ssr` server
/// build) → `$__ssrTpl(`…`)` string descriptors (see [`free_template::lower`]).
pub fn compile_diagnostics_mode(
    source: &str,
    ssr: bool,
    hydrate: bool,
    minify: bool,
) -> (String, Vec<Diagnostic>) {
    let spliced = splice::inline_helpers(source);
    let diags = pragma::diagnose::collect(&spliced);
    // Best-effort transform: a pragma error makes `expand` bail, so the
    // pragmas pass through unexpanded — the inlined `throw` is what surfaces it.
    let expanded = pragma::expand_mode(&spliced, ssr, hydrate, minify).unwrap_or(spliced);
    let lowered = free_template::lower(&rewrite::rewrite(&expanded), ssr);
    let compiled = imports::merge_runtime_imports(&lowered);
    let out = diagnostics::inline(&compiled, &diags);
    (out, diags)
}

/// Like [`compile_diagnostics`], but also emits a `$$__ssr(): string` server-
/// render method into every registered component's class body (behind the CLI
/// `--ssr` flag). The method returns the component's HTML string: a Declarative
/// Shadow DOM wrapper with an inline `<style data-ssr>` for shadow components, or
/// bare host markup for `#no-shadow` ones.
///
/// Packaging (intentional, until the `.server.ts` two-file split): rather than
/// splitting a server module, the SSR methods are injected into the ORIGINAL
/// source at each class body's open brace, then the normal CSR pipeline runs over
/// the injected source — so pragma/rewrite passes carry the method through and the
/// CSR output is a strict superset of the no-`--ssr` build. The emitted method
/// references the SSR-runtime helpers (`$__ssrText`/`$__ssrAttr`/`$__ssrChild`/…)
/// as free identifiers, imported from `@neuralfog/elemix/ssr-runtime`, not the CSR
/// runtime.
pub fn compile_ssr(source: &str, minify: bool) -> (String, Vec<Diagnostic>) {
    // Splice helper templates FIRST so `${this.chip(x)}` calls are inlined into the
    // template holes before `ssr_inner` serializes them - otherwise the SSR method
    // would emit a `this.chip(x)` call whose member the later splice pass removes
    // (it survives only in the CSR `view()`), 500ing at render.
    let spliced = splice::inline_helpers(source);
    let source = spliced.as_str();
    let comps = rewrite::plan_components(source);
    let registered = scan_components(source);
    let located = pragma::locate::locate(source).ok();

    // (body_open, method text) for every registered component. Built against the
    // ORIGINAL offsets; applied back-to-front so earlier offsets stay valid.
    let mut inserts: Vec<(usize, String)> = Vec::new();
    for comp in &comps {
        let Some(decl) = registered.iter().find(|d| d.class == comp.class_name) else {
            continue;
        };
        let (no_shadow, client, document, css_value) = located
            .as_ref()
            .and_then(|l| l.classes.iter().find(|c| c.name == comp.class_name))
            .map(|c| {
                let meta = pragma::resolve(&c.directives).ok();
                let no_shadow = meta.as_ref().map(|m| m.no_shadow).unwrap_or(false);
                let client = meta.as_ref().map(|m| m.client).unwrap_or(false);
                let document = meta.as_ref().map(|m| m.document).unwrap_or(false);
                let css = c.styles.first().map(|s| s.value.clone());
                (no_shadow, client, document, css)
            })
            .unwrap_or((false, false, false, None));

        // The `<style data-ssr>` inner: dynamic `${expr}` by default, or - behind
        // `--minify`, when the stylesheet resolves to a static literal - the CSS
        // shrunk and baked in as static text (escaped for the `` ` `` context).
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

    inserts.sort_by_key(|(at, _)| std::cmp::Reverse(*at));
    let mut injected = source.to_string();
    for (at, text) in inserts {
        injected.insert_str(at, &text);
    }

    let (out, diags) = compile_diagnostics_mode(&injected, true, false, minify);
    (imports::add_ssr_runtime_import(&out), diags)
}

/// Like [`compile_diagnostics`], but also emits a `$$__hydrate(root)` method into
/// every registered component's class body - the client-side hydration path. It
/// binds events and reactive value writes onto the EXISTING server-rendered nodes
/// (reached from `root`) instead of cloning a fresh template, so a server-rendered
/// component becomes reactive in place with no DOM rebuild. This is the client
/// build for an SSR app: the normal CSR `view()` is still emitted (fresh-render
/// fallback / islands), plus this hydrate method. Packaging mirrors [`compile_ssr`]:
/// inject at each class body's open brace, then run the CSR pipeline over it.
pub fn compile_hydrate(source: &str, minify: bool) -> (String, Vec<Diagnostic>) {
    // Splice helpers first (see [`compile_ssr`]): the hydrate holes must be the
    // inlined nested `tpl`, else `${this.chip(x)}` classifies as a TEXT hole and
    // hydrates via `$__setText(node, this.chip(x))` - stringifying a Template.
    let spliced = splice::inline_helpers(source);
    let source = spliced.as_str();
    let comps = rewrite::plan_components(source);
    let emitter = emit::TsEmitter::new();

    let mut inserts: Vec<(usize, String)> = Vec::new();
    // Structural takeover emits `$__template` consts for the builders' row/branch
    // templates; hoist them to module scope (their `$__template`/`$__child`/… come
    // from the same runtime import the CSR `view()` already pulls in).
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

    inserts.sort_by_key(|(at, _)| std::cmp::Reverse(*at));
    let mut injected = source.to_string();
    for (at, text) in inserts {
        injected.insert_str(at, &text);
    }
    if !decls.is_empty() {
        injected = format!("{decls}\n{injected}");
    }

    let (out, diags) = compile_diagnostics_mode(&injected, false, true, minify);
    (imports::add_hydrate_runtime_import(&out), diags)
}

/// Compile + a line-level source map back to the original (`cli` feature).
///
/// `compile` is splice-based, so user code survives verbatim and only shifts;
/// the map recovers each preserved line's origin by diffing original vs. output.
/// Returns `(compiled, source_map_json)`. `source_name` seeds `sources`/`file`
/// (callers that know the real path overwrite `sources[0]`).
#[cfg(feature = "cli")]
pub fn compile_with_map(source: &str, source_name: &str) -> (String, String) {
    let code = compile(source);
    let map = sourcemap::line_map(source, &code, source_name);
    (code, map)
}
