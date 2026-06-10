//! Stage 5 — splice generated code back into the source file.
//!
//! Replaces the `template = () => tpl`...`` class member with a compiled
//! `view()`, hoists the `template(...)` consts to module scope, adds the runtime
//! import, and drops the erased `/directives` import. Only the canonical
//! single-template component is rewritten; anything else (Splice cases) passes
//! through untouched.

use crate::codegen::generate;
use crate::emit::TsEmitter;
use crate::locate::find_html_templates;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Class, ClassElement, Declaration, ImportDeclarationSpecifier, ModuleExportName, PropertyKey,
    Statement,
};
use oxc_parser::Parser;
use oxc_span::SourceType;

const PRIMITIVES: &[&str] = &[
    "template", "clone", "_text", "_attr", "_class", "_style", "_event", "_prop",
    "_model", "_onmodel", "_ref", "_child", "_list",
];

/// Where the edits land in the source.
struct Plan {
    class_start: usize,
    member: (usize, usize),
    directives_import: Option<(usize, usize)>,
    /// The `/types` import span + the specifier names left after dropping
    /// `Template` (which the rewritten `view()` no longer needs).
    types_import: Option<(usize, usize, Vec<String>)>,
}

/// Compile one source file: rewrite the `template` member into `view()`.
pub fn rewrite(source: &str) -> String {
    let templates = find_html_templates(source);
    // Exactly one outermost template == the canonical component. More than one
    // means sub-template members / locals (Splice) — deferred, pass through.
    if templates.len() != 1 {
        return source.to_string();
    }
    let Some(plan) = plan(source) else {
        return source.to_string();
    };

    let t = &templates[0];
    let g = generate(&t.statics, &t.holes, &TsEmitter::new());
    let runtime_import = runtime_import(&g.decls, &g.body);
    let view = format!("view(): DocumentFragment {{\n{}}}", g.body);

    // Apply edits from the back so earlier offsets stay valid.
    let mut edits: Vec<(usize, usize, String)> = vec![
        (plan.member.0, plan.member.1, view),
        (plan.class_start, plan.class_start, format!("{}\n", g.decls)),
        (0, 0, format!("{runtime_import}\n")),
    ];
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

    edits.sort_by(|a, b| b.0.cmp(&a.0));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

/// Locate the class statement start, the `template` member span, and the
/// `/directives` import (if any).
fn plan(source: &str) -> Option<Plan> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut class_start = None;
    let mut member = None;
    let mut directives_import = None;
    let mut types_import = None;

    for stmt in &ret.program.body {
        match stmt {
            Statement::ImportDeclaration(import) => {
                let span = (import.span.start as usize, import.span.end as usize);
                match import.source.value.as_str() {
                    "@neuralfog/elemix/directives" => directives_import = Some(span),
                    "@neuralfog/elemix/types" => {
                        let names = import_names(import);
                        if names.iter().any(|n| n == "Template") {
                            let remaining =
                                names.into_iter().filter(|n| n != "Template").collect();
                            types_import = Some((span.0, span.1, remaining));
                        }
                    }
                    _ => {}
                }
            }
            Statement::ExportNamedDeclaration(export) => {
                if let Some(Declaration::ClassDeclaration(class)) = &export.declaration {
                    class_start = Some(export.span.start as usize);
                    member = find_template_member(class);
                }
            }
            Statement::ClassDeclaration(class) => {
                class_start = Some(class.span.start as usize);
                member = find_template_member(class);
            }
            _ => {}
        }
    }

    Some(Plan {
        class_start: class_start?,
        member: member?,
        directives_import,
        types_import,
    })
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

fn find_template_member(class: &Class) -> Option<(usize, usize)> {
    for element in &class.body.body {
        if let ClassElement::PropertyDefinition(prop) = element {
            if let PropertyKey::StaticIdentifier(id) = &prop.key {
                if id.name.as_str() == "template" {
                    return Some((prop.span.start as usize, prop.span.end as usize));
                }
            }
        }
    }
    None
}

/// Build the runtime import for exactly the primitives the generated code uses.
fn runtime_import(decls: &str, body: &str) -> String {
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
