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
    let spliced = splice::inline_helpers(source);
    let diags = pragma::diagnose::collect(&spliced);
    // Best-effort transform: a pragma error makes `expand` bail, so the
    // pragmas pass through unexpanded — the inlined `throw` is what surfaces it.
    let expanded = pragma::expand(&spliced).unwrap_or(spliced);
    let lowered = free_template::lower(&rewrite::rewrite(&expanded));
    let compiled = imports::merge_runtime_imports(&lowered);
    let out = diagnostics::inline(&compiled, &diags);
    (out, diags)
}

/// Like [`compile_diagnostics`], but also emits a `$$__ssr(): string` server-
/// render method into every registered component's class body (slice 1, behind
/// the CLI `--ssr` flag). The method returns the component's HTML string: a
/// Declarative Shadow DOM wrapper with an inline `<style data-ssr>` for shadow
/// components, or bare host markup for `#no-shadow` ones.
///
/// Slice 1 packaging (intentional, revisited in a later slice): rather than
/// splitting a `.server.ts` file, the SSR methods are injected into the ORIGINAL
/// source at each class body's open brace, then the normal CSR pipeline runs over
/// the injected source — so pragma/rewrite passes carry the method through and the
/// CSR output is a strict superset of the no-`--ssr` build. The emitted method
/// references the SSR-runtime stubs `$__ssrText`/`$__ssrAttr`/`$__ssrSlot` as free
/// identifiers; they are deliberately NOT added to the CSR runtime import.
pub fn compile_ssr(source: &str) -> (String, Vec<Diagnostic>) {
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
        let (no_shadow, css_value) = located
            .as_ref()
            .and_then(|l| l.classes.iter().find(|c| c.name == comp.class_name))
            .map(|c| {
                let no_shadow = pragma::resolve(&c.directives)
                    .map(|m| m.no_shadow)
                    .unwrap_or(false);
                let css = c.styles.first().map(|s| s.value.clone());
                (no_shadow, css)
            })
            .unwrap_or((false, None));

        let inner = template::parse::ssr_inner(&comp.statics, &comp.holes);
        let method = ssr::ssr_method(
            &decl.tag,
            css_value.as_deref(),
            no_shadow,
            &comp.prelude,
            &inner,
        );
        inserts.push((comp.body_open, format!("\n{method}\n")));
    }

    inserts.sort_by_key(|(at, _)| std::cmp::Reverse(*at));
    let mut injected = source.to_string();
    for (at, text) in inserts {
        injected.insert_str(at, &text);
    }

    let (out, diags) = compile_diagnostics(&injected);
    (imports::add_ssr_runtime_import(&out), diags)
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
