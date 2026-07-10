//! Lower free-standing `tpl` templates — any `` tpl`...` `` that is not a
//! component's `template` member — into an inline IIFE returning a
//! `DocumentFragment`, wiring the same runtime bindings a compiled `view()` gets.
//! This is what lets a Storybook `render` (or any helper) mount a component with
//! `:props`/`@event`/`~model` and no wrapper.
//!
//! Runs after `rewrite`, so the only `tpl` left in the module are the free ones;
//! a nested `tpl` inside a hole is lowered by the codegen from its parent.

use crate::codegen::generate_free;
use crate::emit::TsEmitter;
use crate::rewrite::runtime_import;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Expression, ImportDeclaration, ImportDeclarationSpecifier, ModuleExportName, Statement,
    TaggedTemplateExpression,
};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// One free template: its full `tpl`…`` span and the template's statics + holes.
struct Free {
    span: (usize, usize),
    statics: Vec<String>,
    holes: Vec<String>,
}

struct Finder<'s> {
    source: &'s str,
    out: Vec<Free>,
}

impl Finder<'_> {
    fn slice(&self, span: Span) -> String {
        self.source[span.start as usize..span.end as usize].to_string()
    }
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
                    .map(|e| self.slice(e.span()))
                    .collect();
                self.out.push(Free {
                    span: (it.span.start as usize, it.span.end as usize),
                    statics,
                    holes,
                });
                // Outermost-only: a nested `tpl` lives inside this one's holes and
                // is lowered by the codegen from there.
                return;
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }
}

/// Replace every free `tpl`…`` with an inline IIFE, hoist the shared consts +
/// runtime import to the top, and drop the now-unused `tpl` from the main import.
/// A module with no free template passes through unchanged.
pub fn lower(source: &str) -> String {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut finder = Finder {
        source,
        out: Vec::new(),
    };
    finder.visit_program(&ret.program);
    if finder.out.is_empty() {
        return source.to_string();
    }

    // The `@neuralfog/elemix` import loses `tpl` once every use is lowered (unless
    // `rewrite` already dropped it for a component in the same file).
    let mut main_import: Option<(usize, usize, Vec<String>)> = None;
    for stmt in &ret.program.body {
        if let Statement::ImportDeclaration(import) = stmt {
            if import.source.value.as_str() == "@neuralfog/elemix" {
                let names = import_names(import);
                if names.iter().any(|n| n == "tpl") {
                    let remaining = names.into_iter().filter(|n| n != "tpl").collect();
                    main_import = Some((
                        import.span.start as usize,
                        import.span.end as usize,
                        remaining,
                    ));
                }
            }
        }
    }

    let emitter = TsEmitter::new();
    let templates: Vec<(Vec<String>, Vec<String>)> = finder
        .out
        .iter()
        .map(|f| (f.statics.clone(), f.holes.clone()))
        .collect();
    let (decls, bodies) = generate_free(&templates, &emitter);
    let import_line = runtime_import(&decls, &bodies.join("\n"));

    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    for (f, body) in finder.out.iter().zip(&bodies) {
        edits.push((f.span.0, f.span.1, format!("(() => {{\n{body}}})()")));
    }
    // ESM hoists imports, so the runtime import + hoisted consts sit safely at the
    // top ahead of the user's own imports.
    edits.push((0, 0, format!("{import_line}\n{decls}")));

    if let Some((s, e, remaining)) = main_import {
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

    edits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

fn import_names(import: &ImportDeclaration) -> Vec<String> {
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

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
