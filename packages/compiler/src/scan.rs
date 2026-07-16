//! Analyzer frontend — surface what `ec-analyzer` needs that the compile path
//! discards: the project's `#component` declarations (tag → class), every bound
//! prop SITE in a `tpl` template with its ABSOLUTE source span, and malformed
//! compiler hints WITH a span (the runtime-injection pass keeps the message but
//! drops the location).
//!
//! Pure oxc, no IO, no `cli`/`wasm` deps — the analyzer pulls the compiler in as
//! a library with `default-features = false` and reuses this. Returns owned,
//! oxc-free types so the analyzer never sees an oxc handle.

use crate::grammar::{classify, BindingKind};
use crate::pragma::diagnose::{
    binding_issue_message, invalid_tag_message, MODULE_STATE_PRIMITIVE_MSG,
};
use crate::pragma::locate::ClassInfo;
use crate::pragma::lower::ExpandError;
use crate::pragma::{kebab, locate::locate, resolve, tag_problem, PragmaError};
use crate::template::parse::{parse_spanned, SpannedHole};
use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, ImportDeclarationSpecifier, Statement, TaggedTemplateExpression};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// A `#component` class and the custom-element tag it registers (explicit `#tag`
/// or the [`kebab`]-derived class name — the SAME rule the compiler emits).
#[derive(Debug, PartialEq)]
pub struct ComponentDecl {
    pub tag: String,
    pub class: String,
    /// Whether the class is `export`ed — the analyzer can only `import` it into a
    /// synthetic assert file when it is (otherwise the site is reported skipped).
    pub exported: bool,
}

/// One bound `:prop=${expr}` site: the tag bearing it, the prop name, the
/// verbatim hole expression, and its absolute byte span in the original source.
#[derive(Debug, PartialEq)]
pub struct PropSite {
    pub tag: String,
    pub prop: String,
    pub expr: String,
    pub start: u32,
    pub end: u32,
}

/// One element usage of a tag in a template, with the props it provides — the
/// unit for REQUIRED-prop checking (does the provided set cover the component's
/// required props?). EVERY usage is surfaced, including ones that bind no props
/// (the "forgot everything" case), so the check is exhaustive.
#[derive(Debug, PartialEq)]
pub struct ElementUse {
    pub tag: String,
    /// Absolute span of the tag NAME in `<tag …>` — the caret for a missing prop.
    pub tag_start: u32,
    pub tag_end: u32,
    /// The prop names this usage provides (in source order).
    pub provided: Vec<String>,
}

/// A module dependency of a file: an `import`/`export … from` specifier plus the
/// names it pulls in. Loading the module runs its `defineComponent` side effects,
/// so this is what tells the analyzer whether a used component is reachable.
#[derive(Debug, PartialEq)]
pub struct Import {
    pub specifier: String,
    pub names: Vec<String>,
}

/// Every module specifier `source` depends on — `import … from`, `export … from`,
/// and `export * from`. Side-effect imports (`import './x'`) carry no names.
pub fn scan_imports(source: &str) -> Vec<Import> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();
    let mut out = Vec::new();
    for stmt in &ret.program.body {
        match stmt {
            Statement::ImportDeclaration(d) => {
                let names = d
                    .specifiers
                    .iter()
                    .flatten()
                    .map(|s| match s {
                        ImportDeclarationSpecifier::ImportSpecifier(i) => {
                            i.imported.name().to_string()
                        }
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(i) => {
                            i.local.name.to_string()
                        }
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(i) => {
                            i.local.name.to_string()
                        }
                    })
                    .collect();
                out.push(Import {
                    specifier: d.source.value.to_string(),
                    names,
                });
            }
            Statement::ExportNamedDeclaration(d) => {
                if let Some(src) = &d.source {
                    out.push(Import {
                        specifier: src.value.to_string(),
                        names: d
                            .specifiers
                            .iter()
                            .map(|s| s.exported.name().to_string())
                            .collect(),
                    });
                }
            }
            Statement::ExportAllDeclaration(d) => out.push(Import {
                specifier: d.source.value.to_string(),
                names: Vec::new(),
            }),
            _ => {}
        }
    }
    out
}

/// Every `#component` declaration in `source`, mapped to its registered tag.
pub fn scan_components(source: &str) -> Vec<ComponentDecl> {
    let Ok(located) = locate(source) else {
        return Vec::new();
    };
    located
        .classes
        .iter()
        .filter_map(|c| {
            let meta = resolve(&c.directives).ok()?;
            if !meta.register {
                return None;
            }
            let tag = meta.tag.clone().unwrap_or_else(|| kebab(&c.name));
            let exported = source[c.start..].trim_start().starts_with("export");
            Some(ComponentDecl {
                tag,
                class: c.name.clone(),
                exported,
            })
        })
        .collect()
}

/// Every `:prop` binding site in every `tpl` template in `source`, with absolute
/// spans — recursing into nested templates (list rows, `when`/`choose` arms).
///
/// Only `Prop` bindings are returned: they are always a single bare hole, so the
/// expr is a verbatim source slice and the span is exact. Attrs/events/refs are
/// not type-checked against a prop, so they're dropped here.
pub fn scan_props(source: &str) -> Vec<PropSite> {
    let mut out = Vec::new();
    scan_into(source, 0, &mut out);
    out
}

/// `base` is the absolute file offset at which `snippet` begins, so every span
/// inside it maps to the original source as `base + span`.
fn scan_into(snippet: &str, base: u32, out: &mut Vec<PropSite>) {
    for tpl in outermost_templates(snippet) {
        let parsed = parse_spanned(&tpl.statics, &tpl.holes);
        for binding in parsed.holes.iter().map(classify) {
            if binding.kind == BindingKind::Prop {
                if let (Some(tag), Some(prop)) = (&binding.tag, &binding.name) {
                    out.push(PropSite {
                        tag: tag.clone(),
                        prop: prop.clone(),
                        expr: binding.expr.clone(),
                        start: base + binding.span.start,
                        end: base + binding.span.end,
                    });
                }
            }
            // A content hole can carry nested templates (`repeat`, `when`, a
            // ternary of `tpl`). Recurse with the hole's absolute offset as base
            // so nested carets land in the original file. Bare prop holes never
            // contain `tpl`, so this skips them.
            if binding.expr.contains("tpl`") {
                scan_into(&binding.expr, base + binding.span.start, out);
            }
        }
    }
}

/// A non-prop binding whose value has a FIXED expected type (independent of any
/// component): an event handler, a ref, or a two-way model / its transform.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum SpecialKind {
    Event,   // `@evt=${h}`     → h: EventListener
    Ref,     // `:ref=${r}`     → r: { value: unknown }
    Model,   // `~model=${m}`   → m: { value: string }
    OnModel, // `~onmodel=${t}` → t: (value: string) => string
}

/// One event/ref/model/onmodel binding site: its kind, the element bearing it,
/// the event name (events only), the verbatim expr, and its absolute span.
#[derive(Debug, PartialEq)]
pub struct SpecialBinding {
    pub kind: SpecialKind,
    pub tag: String,
    pub name: Option<String>,
    pub expr: String,
    pub start: u32,
    pub end: u32,
}

/// Every `@event`/`:ref`/`~model`/`~onmodel` binding site in every template, with
/// absolute spans — recursing into nested templates like [`scan_props`]. Checked
/// on ANY element (the expected type doesn't depend on the component).
pub fn scan_special_bindings(source: &str) -> Vec<SpecialBinding> {
    let mut out = Vec::new();
    special_into(source, 0, &mut out);
    out
}

fn special_into(snippet: &str, base: u32, out: &mut Vec<SpecialBinding>) {
    for tpl in outermost_templates(snippet) {
        let parsed = parse_spanned(&tpl.statics, &tpl.holes);
        for binding in parsed.holes.iter().map(classify) {
            let kind = match binding.kind {
                BindingKind::Event => Some(SpecialKind::Event),
                BindingKind::Ref => Some(SpecialKind::Ref),
                BindingKind::Model => Some(SpecialKind::Model),
                BindingKind::OnModel => Some(SpecialKind::OnModel),
                _ => None,
            };
            if let (Some(kind), Some(tag)) = (kind, &binding.tag) {
                out.push(SpecialBinding {
                    kind,
                    tag: tag.clone(),
                    name: binding.name.clone(),
                    expr: binding.expr.clone(),
                    start: base + binding.span.start,
                    end: base + binding.span.end,
                });
            }
            if binding.expr.contains("tpl`") {
                special_into(&binding.expr, base + binding.span.start, out);
            }
        }
    }
}

/// One `match(...)` content hole: the verbatim call expression and its absolute
/// span. The exhaustiveness / narrowing / typed-value checks all ride on the
/// `match` overload types, so the analyzer only needs the site's coordinates to
/// attribute tsc's diagnostic back to the hole.
#[derive(Debug, PartialEq)]
pub struct MatchSite {
    pub expr: String,
    pub start: u32,
    pub end: u32,
}

/// Every `match(...)` content hole in every template, with absolute spans —
/// recursing into nested templates like [`scan_props`].
pub fn scan_match_sites(source: &str) -> Vec<MatchSite> {
    let mut out = Vec::new();
    match_into(source, 0, &mut out);
    out
}

fn match_into(snippet: &str, base: u32, out: &mut Vec<MatchSite>) {
    for tpl in outermost_templates(snippet) {
        let parsed = parse_spanned(&tpl.statics, &tpl.holes);
        for binding in parsed.holes.iter().map(classify) {
            if binding.kind == BindingKind::Child && binding.expr.trim_start().starts_with("match(")
            {
                out.push(MatchSite {
                    expr: binding.expr.clone(),
                    start: base + binding.span.start,
                    end: base + binding.span.end,
                });
            }
            if binding.expr.contains("tpl`") {
                match_into(&binding.expr, base + binding.span.start, out);
            }
        }
    }
}

/// Every element usage in every template, with the prop set it provides — the
/// input to REQUIRED-prop checking. Found by enumerating every `<tag` open across
/// all templates (so zero-prop usages count too) and assigning each `:prop` hole
/// to the element it sits in. Recurses into nested templates like [`scan_props`].
pub fn scan_element_uses(source: &str) -> Vec<ElementUse> {
    let mut tags = scan_open_tags(source); // every `<tag` open, absolute spans
    tags.sort_by_key(|t| t.1);
    let props = scan_props(source);

    // A `:prop` hole always sits in the open tag of the most recent `<tag` before
    // it — no other open tag can intervene between a tag and its own attributes.
    let mut provided: Vec<Vec<String>> = vec![Vec::new(); tags.len()];
    for p in &props {
        if let Some(idx) = tags.iter().rposition(|t| t.1 < p.start) {
            provided[idx].push(p.prop.clone());
        }
    }

    tags.into_iter()
        .zip(provided)
        .map(|((tag, start, end), provided)| ElementUse {
            tag,
            tag_start: start,
            tag_end: end,
            provided,
        })
        .collect()
}

/// Every `<tag` open in every `tpl` template (including nested), as `(tag, name
/// start, name end)` with absolute spans. Tag names live in the static segments,
/// so this scans each quasi's text — `<` inside a `${…}` hole is never a tag.
fn scan_open_tags(source: &str) -> Vec<(String, u32, u32)> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();
    let mut finder = TagFinder {
        source,
        out: Vec::new(),
    };
    finder.visit_program(&ret.program);
    finder.out
}

struct TagFinder<'s> {
    source: &'s str,
    out: Vec<(String, u32, u32)>,
}

impl<'a> Visit<'a> for TagFinder<'_> {
    fn visit_tagged_template_expression(&mut self, it: &TaggedTemplateExpression<'a>) {
        if let Expression::Identifier(ident) = &it.tag {
            if &self.source[ident.span.start as usize..ident.span.end as usize] == "tpl" {
                for quasi in &it.quasi.quasis {
                    scan_quasi_tags(self.source, quasi.span, &mut self.out);
                }
            }
        }
        // No early return — recurse so NESTED templates' tags are found too.
        walk::walk_tagged_template_expression(self, it);
    }
}

/// Scan one static segment for `<tag` opens. A tag is `<` then an ASCII letter,
/// then `[A-Za-z0-9-]*`; `</close>` and `<` not starting a name are skipped.
fn scan_quasi_tags(source: &str, span: Span, out: &mut Vec<(String, u32, u32)>) {
    let bytes = source.as_bytes();
    let (lo, hi) = (span.start as usize, (span.end as usize).min(source.len()));
    let mut i = lo;
    while i < hi {
        if bytes[i] == b'<' && i + 1 < hi && bytes[i + 1].is_ascii_alphabetic() {
            let name_start = i + 1;
            let mut j = name_start;
            while j < hi && is_tag_char(bytes[j]) {
                j += 1;
            }
            out.push((
                source[name_start..j].to_string(),
                name_start as u32,
                j as u32,
            ));
            i = j;
        } else {
            i += 1;
        }
    }
}

fn is_tag_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-'
}

/// A located `tpl` template: its static segments + spanned hole expressions.
struct Tpl {
    statics: Vec<String>,
    holes: Vec<SpannedHole>,
}

struct Finder<'s> {
    source: &'s str,
    out: Vec<Tpl>,
}

impl Finder<'_> {
    fn slice(&self, span: Span) -> String {
        self.source[span.start as usize..span.end as usize].to_string()
    }
}

/// Outermost-only `tpl` templates in `source`, each keeping its holes' spans
/// (relative to `source`). Nested templates live inside hole exprs and are
/// reached by recursion, not here. Parse errors yield no templates (panic-free).
fn outermost_templates(source: &str) -> Vec<Tpl> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();
    let mut finder = Finder {
        source,
        out: Vec::new(),
    };
    finder.visit_program(&ret.program);
    finder.out
}

impl<'a> Visit<'a> for Finder<'_> {
    fn visit_tagged_template_expression(&mut self, it: &TaggedTemplateExpression<'a>) {
        if let Expression::Identifier(ident) = &it.tag {
            if self.slice(ident.span) == "tpl" {
                let statics = it.quasi.quasis.iter().map(|q| self.slice(q.span)).collect();
                let holes = it
                    .quasi
                    .expressions
                    .iter()
                    .map(|e| {
                        let span = e.span();
                        SpannedHole {
                            expr: self.slice(span),
                            span,
                        }
                    })
                    .collect();
                self.out.push(Tpl { statics, holes });
                return;
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }
}

/// Severity of a compiler-hint diagnostic — a malformed hint is an `Error`, a
/// registered-but-invalid tag is a `Warning` (matches the compiler).
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum HintSeverity {
    Error,
    Warning,
}

/// What a hint diagnostic is about — lets the analyzer word it correctly.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum HintKind {
    /// A `// #...` compiler hint (unknown directive, wrong target, …).
    Directive,
    /// An invalid custom-element tag (checked against the class name / `#tag`).
    Tag,
}

/// A malformed `// #...` compiler-hint problem WITH a span to caret it. Mirrors
/// the compiler's own pragma diagnostics (same `locate`+`resolve` path and the
/// shared message text), keeping the location the runtime-injection pass drops.
/// A zero-width span (`start == end`) means file-level (no declaration to point
/// at, e.g. an orphan pragma).
#[derive(Debug, PartialEq)]
pub struct HintDiagnostic {
    pub severity: HintSeverity,
    pub kind: HintKind,
    pub message: String,
    pub class: Option<String>,
    pub start: u32,
    pub end: u32,
}

/// Every malformed-compiler-hint problem in `source`, each with a span. This is
/// the analyzer's view of [`crate::pragma::diagnose::collect`] — same checks,
/// same messages, but located so the analyzer can frame the offending hint.
pub fn scan_hints(source: &str) -> Vec<HintDiagnostic> {
    let mut out = Vec::new();

    let located = match locate(source) {
        Ok(l) => l,
        // A located failure carets the offending member; a spanless one (an orphan
        // pragma, a structural parse error) stays file-level.
        Err(e) => {
            let (start, end) = e.span.map_or((0, 0), |(s, en)| (s as u32, en as u32));
            out.push(HintDiagnostic {
                severity: HintSeverity::Error,
                kind: HintKind::Directive,
                message: ExpandError::Locate(e.err).to_string(),
                class: e.component.clone(),
                start,
                end,
            });
            return out;
        }
    };

    // A member directive on the wrong target — caret the member name.
    for b in &located.binding_issues {
        out.push(HintDiagnostic {
            severity: HintSeverity::Error,
            kind: HintKind::Directive,
            message: binding_issue_message(&b.directive, &b.member, b.problem),
            class: Some(b.class.clone()),
            start: b.start as u32,
            end: b.end as u32,
        });
    }

    // A module-level `#state` const can't be a bare primitive — point at the
    // offending initializer.
    for st in &located.states {
        if st.module_primitive {
            out.push(HintDiagnostic {
                severity: HintSeverity::Error,
                kind: HintKind::Directive,
                message: MODULE_STATE_PRIMITIVE_MSG.to_string(),
                class: None,
                start: st.start as u32,
                end: st.end as u32,
            });
        }
    }

    for class in &located.classes {
        if class.directives.is_empty() {
            continue;
        }
        // The class name is the FALLBACK anchor; the precise caret is the offending
        // hint TOKEN in the comment (a bad directive name, or a `#tag` value).
        let fallback = class_name_span(source, &class.name, class.start, class.end);
        match resolve(&class.directives) {
            Ok(meta) => {
                if meta.register {
                    let explicit = meta.tag.is_some();
                    let tag = meta.tag.unwrap_or_else(|| kebab(&class.name));
                    if let Some(reason) = tag_problem(&tag) {
                        // Explicit `#tag <value>` → caret the value; a tag DERIVED
                        // from the class name → caret the class name (its source).
                        let (start, end) = if explicit {
                            tag_arg_span(class).unwrap_or(fallback)
                        } else {
                            fallback
                        };
                        out.push(HintDiagnostic {
                            // An invalid tag is broken, not advisory — fail on it.
                            severity: HintSeverity::Error,
                            kind: HintKind::Tag,
                            message: invalid_tag_message(&tag, &reason, !explicit),
                            class: Some(class.name.clone()),
                            start,
                            end,
                        });
                    }
                }
            }
            Err(e) => {
                let (start, end) = error_span(&e, class).unwrap_or(fallback);
                out.push(HintDiagnostic {
                    severity: HintSeverity::Error,
                    kind: HintKind::Directive,
                    message: ExpandError::Resolve(e).to_string(),
                    class: Some(class.name.clone()),
                    start,
                    end,
                });
            }
        }
    }

    out
}

/// Absolute span of the `#tag` directive's first arg (the explicit tag value).
fn tag_arg_span(class: &ClassInfo) -> Option<(u32, u32)> {
    class
        .directive_spans
        .iter()
        .find(|d| d.name == "tag")
        .and_then(|d| d.args.first())
        .map(|(_, (s, e))| (*s as u32, *e as u32))
}

/// Where to caret a resolve error: the offending directive's name token in the
/// comment (the unknown/misplaced directive, or `#tag` for an arity/dup error).
fn error_span(e: &PragmaError, class: &ClassInfo) -> Option<(u32, u32)> {
    let name = match e {
        PragmaError::Unknown(n) | PragmaError::OnClass(n) => n.as_str(),
        PragmaError::TagArity | PragmaError::DuplicateTag(_, _) => "tag",
        PragmaError::ShadowConflict => "shadow",
    };
    class
        .directive_spans
        .iter()
        .find(|d| d.name == name)
        .map(|d| (d.name_span.0 as u32, d.name_span.1 as u32))
}

/// Locate the class NAME within its declaration so the fallback caret lands on
/// the component, not the `export`/`class` keywords. Falls back to the statement
/// start if the name can't be found.
fn class_name_span(source: &str, name: &str, stmt_start: usize, stmt_end: usize) -> (u32, u32) {
    let end = stmt_end.min(source.len());
    if let Some(rel) = source[stmt_start..end].find(name) {
        let s = stmt_start + rel;
        (s as u32, (s + name.len()) as u32)
    } else {
        (stmt_start as u32, stmt_start as u32)
    }
}
