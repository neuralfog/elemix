//! Stage 5 — splice generated code back into the source file.
//!
//! For EVERY component class in the module, replaces its `template = () => tpl`…``
//! member with a compiled `view()`. The hoisted `template(...)` consts are shared
//! across all components (uniquely numbered, deduped) and placed above the first
//! class; the runtime import is wired once, the erased `/directives` import is
//! dropped, and the compile-time `tpl` tag is stripped from the main import. A
//! file may hold any number of components; one with none passes through.

use crate::codegen::generate_all;
use crate::emit::TsEmitter;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, Class, ClassElement, Declaration, Expression,
    ImportDeclarationSpecifier, MethodDefinitionKind, ModuleExportName, PropertyKey, Statement,
    TaggedTemplateExpression,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

const PRIMITIVES: &[&str] = &[
    "$__template",
    "$__clone",
    "$__templateEl",
    "$__cloneEl",
    "$__toRaw",
    "$__event",
    "$__model",
    "$__onmodel",
    "$__ref",
    "$__child",
    "$__list",
    "$__effect",
    "$__setText",
    "$__setAttr",
    "$__setClass",
    "$__setStyle",
    "$__setProp",
];

/// One component to rewrite: where its class begins, its `template` member span,
/// the block-body prelude (statements before `return tpl`, e.g. a destructure),
/// and its template's statics + holes.
struct Comp {
    class_start: usize,
    member: (usize, usize),
    prelude: String,
    statics: Vec<String>,
    holes: Vec<String>,
}

/// Where the edits land in the source.
struct Plan {
    comps: Vec<Comp>,
    directives_import: Option<(usize, usize)>,
    /// The `/types` import span + the names left after dropping `Template`.
    types_import: Option<(usize, usize, Vec<String>)>,
    /// The main `@neuralfog/elemix` import span + the names left after dropping `tpl`.
    main_import: Option<(usize, usize, Vec<String>)>,
}

/// Compile one source file: rewrite every `template` member into a `view()`.
pub fn rewrite(source: &str) -> String {
    let plan = plan(source);
    if plan.comps.is_empty() {
        return source.to_string();
    }

    // Generate all views against ONE shared codegen context so the hoisted
    // `template(...)` consts never collide between components.
    let emitter = TsEmitter::new();
    let templates: Vec<(Vec<String>, Vec<String>)> = plan
        .comps
        .iter()
        .map(|c| (c.statics.clone(), c.holes.clone()))
        .collect();
    let (decls, bodies) = generate_all(&templates, &emitter);
    let runtime_import = runtime_import(&decls, &bodies.join("\n"));

    let mut edits: Vec<(usize, usize, String)> = Vec::new();

    // Each component's `template` member → its compiled `view()`.
    for (c, body) in plan.comps.iter().zip(&bodies) {
        let view = if c.prelude.is_empty() {
            format!("$$__view(): DocumentFragment {{\n{body}}}")
        } else {
            format!("$$__view(): DocumentFragment {{\n{}\n{body}}}", c.prelude)
        };
        edits.push((c.member.0, c.member.1, view));
    }

    // The shared module-scope `template(...)` consts go above the first class.
    let first_class = plan.comps.iter().map(|c| c.class_start).min().unwrap();
    edits.push((first_class, first_class, format!("{decls}\n")));
    edits.push((0, 0, format!("{runtime_import}\n")));

    if let Some((s, e)) = plan.directives_import {
        let e = e + trailing_newline(source, e);
        edits.push((s, e, String::new()));
    }
    if let Some((s, e, remaining)) = plan.types_import {
        if remaining.is_empty() {
            let e = e + trailing_newline(source, e);
            edits.push((s, e, String::new()));
        } else {
            edits.push((
                s,
                e,
                format!(
                    "import type {{ {} }} from '@neuralfog/elemix/types';",
                    remaining.join(", ")
                ),
            ));
        }
    }
    if let Some((s, e, remaining)) = plan.main_import {
        if remaining.is_empty() {
            let e = e + trailing_newline(source, e);
            edits.push((s, e, String::new()));
        } else {
            edits.push((
                s,
                e,
                format!(
                    "import {{ {} }} from '@neuralfog/elemix';",
                    remaining.join(", ")
                ),
            ));
        }
    }

    // Back-to-front by start; on a tie (the main-import replace at 0 vs. the
    // runtime-import insert at 0) the wider replace applies first.
    edits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

/// Collect every component + the erasable imports.
fn plan(source: &str) -> Plan {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut comps = Vec::new();
    let mut directives_import = None;
    let mut types_import = None;
    let mut main_import = None;

    for stmt in &ret.program.body {
        match stmt {
            Statement::ImportDeclaration(import) => {
                let span = (import.span.start as usize, import.span.end as usize);
                match import.source.value.as_str() {
                    "@neuralfog/elemix/directives" => directives_import = Some(span),
                    "@neuralfog/elemix/types" => {
                        let names = import_names(import);
                        if names.iter().any(|n| n == "Template") {
                            let remaining = names.into_iter().filter(|n| n != "Template").collect();
                            types_import = Some((span.0, span.1, remaining));
                        }
                    }
                    "@neuralfog/elemix" => {
                        let names = import_names(import);
                        if names.iter().any(|n| n == "tpl") {
                            let remaining = names.into_iter().filter(|n| n != "tpl").collect();
                            main_import = Some((span.0, span.1, remaining));
                        }
                    }
                    _ => {}
                }
            }
            Statement::ExportNamedDeclaration(export) => {
                if let Some(Declaration::ClassDeclaration(class)) = &export.declaration {
                    if let Some(c) = component(source, export.span.start as usize, class) {
                        comps.push(c);
                    }
                }
            }
            Statement::ClassDeclaration(class) => {
                if let Some(c) = component(source, class.span.start as usize, class) {
                    comps.push(c);
                }
            }
            _ => {}
        }
    }

    Plan {
        comps,
        directives_import,
        types_import,
        main_import,
    }
}

/// A `Comp` for a class IFF it has a `template` member returning a `tpl`…`` —
/// either the arrow field `template = () => tpl`…`` or the method
/// `template() { return tpl`…`; }`. Both lower to the same `view()`.
fn component(source: &str, class_start: usize, class: &Class) -> Option<Comp> {
    for element in &class.body.body {
        let (member, prelude, tt) = match element {
            ClassElement::PropertyDefinition(prop) if is_template_key(&prop.key) => {
                let Some(Expression::ArrowFunctionExpression(arrow)) = &prop.value else {
                    return None;
                };
                (
                    prop.span,
                    arrow_prelude(source, arrow),
                    template_tag(arrow)?,
                )
            }
            ClassElement::MethodDefinition(m)
                if m.kind == MethodDefinitionKind::Method && is_template_key(&m.key) =>
            {
                let body = m.value.body.as_ref()?;
                let stmts = &body.statements;
                (m.span, block_prelude(source, stmts), return_tag(stmts)?)
            }
            _ => continue,
        };
        if !is_tpl(source, tt) {
            return None;
        }
        let statics = tt
            .quasi
            .quasis
            .iter()
            .map(|q| slice(source, q.span))
            .collect();
        let holes = tt
            .quasi
            .expressions
            .iter()
            .map(|e| slice(source, e.span()))
            .collect();
        return Some(Comp {
            class_start,
            member: (member.start as usize, member.end as usize),
            prelude,
            statics,
            holes,
        });
    }
    None
}

fn is_template_key(key: &PropertyKey) -> bool {
    matches!(key, PropertyKey::StaticIdentifier(id) if id.name.as_str() == "template")
}

/// The `tpl`…`` an arrow `template` returns — directly (expression body) or via
/// the `return` (block body).
fn template_tag<'a>(
    arrow: &'a ArrowFunctionExpression,
) -> Option<&'a TaggedTemplateExpression<'a>> {
    if arrow.expression {
        let Statement::ExpressionStatement(es) = arrow.body.statements.first()? else {
            return None;
        };
        match &es.expression {
            Expression::TaggedTemplateExpression(tt) => Some(tt),
            _ => None,
        }
    } else {
        return_tag(&arrow.body.statements)
    }
}

/// The `tpl`…`` returned by the last `return` in a block of statements (the
/// shared block-body case for arrows and methods).
fn return_tag<'a>(stmts: &'a [Statement<'a>]) -> Option<&'a TaggedTemplateExpression<'a>> {
    let ret = stmts.iter().rev().find_map(|s| match s {
        Statement::ReturnStatement(r) => Some(r),
        _ => None,
    })?;
    match ret.argument.as_ref()? {
        Expression::TaggedTemplateExpression(tt) => Some(tt),
        _ => None,
    }
}

fn is_tpl(source: &str, tt: &TaggedTemplateExpression) -> bool {
    matches!(&tt.tag, Expression::Identifier(id) if slice(source, id.span) == "tpl")
}

/// For a block body `{ …prelude…; return tpl`…`; }` (arrow or method), the
/// source of the statements before the `return` — they must survive into
/// `view()` (e.g. a `const { inc } = this` destructure the holes reference).
fn block_prelude(source: &str, stmts: &[Statement]) -> String {
    if stmts.len() <= 1 {
        return String::new();
    }
    let start = stmts[0].span().start as usize;
    let end = stmts[stmts.len() - 2].span().end as usize;
    source[start..end].to_string()
}

fn arrow_prelude(source: &str, arrow: &ArrowFunctionExpression) -> String {
    if arrow.expression {
        return String::new();
    }
    block_prelude(source, &arrow.body.statements)
}

fn slice(source: &str, span: Span) -> String {
    source[span.start as usize..span.end as usize].to_string()
}

/// The imported names of a named import declaration.
fn import_names(import: &oxc_ast::ast::ImportDeclaration) -> Vec<String> {
    let Some(specifiers) = &import.specifiers else {
        return Vec::new();
    };
    specifiers
        .iter()
        .filter_map(|s| match s {
            ImportDeclarationSpecifier::ImportSpecifier(spec) => match &spec.imported {
                ModuleExportName::IdentifierName(id) => Some(id.name.to_string()),
                ModuleExportName::IdentifierReference(id) => Some(id.name.to_string()),
                ModuleExportName::StringLiteral(s) => Some(s.value.to_string()),
            },
            _ => None,
        })
        .collect()
}

/// Build the runtime import for exactly the primitives the generated code uses.
pub(crate) fn runtime_import(decls: &str, body: &str) -> String {
    let used: Vec<&str> = PRIMITIVES
        .iter()
        .copied()
        .filter(|p| decls.contains(&format!("{p}(")) || body.contains(&format!("{p}(")))
        .collect();
    format!(
        "import {{ {} }} from '@neuralfog/elemix/runtime';",
        used.join(", ")
    )
}

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
