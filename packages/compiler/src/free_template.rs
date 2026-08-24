use crate::codegen::generate_free;
use crate::emit::TsEmitter;
use crate::lower::{apply_edits, trailing_newline};
use crate::rewrite::runtime_import;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Expression, ImportDeclaration, ImportDeclarationSpecifier, ModuleExportName, Statement,
    TaggedTemplateExpression,
};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

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
                return;
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }
}

pub fn lower(source: &str, ssr: bool) -> String {
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

    let drop_tpl = |edits: &mut Vec<(usize, usize, String)>| {
        if let Some((s, e, remaining)) = &main_import {
            if remaining.is_empty() {
                let e = e + trailing_newline(source, *e);
                edits.push((*s, e, String::new()));
            } else {
                edits.push((
                    *s,
                    *e,
                    format!(
                        "import {{ {} }} from '@neuralfog/elemix';",
                        remaining.join(", ")
                    ),
                ));
            }
        }
    };

    let apply = |edits: Vec<(usize, usize, String)>| apply_edits(source, edits);

    if ssr {
        let mut edits: Vec<(usize, usize, String)> = Vec::new();
        for f in &finder.out {
            let body = crate::template::parse::ssr_nested_tpl(&f.statics, &f.holes);
            edits.push((f.span.0, f.span.1, body));
        }
        drop_tpl(&mut edits);
        return apply(edits);
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
    edits.push((0, 0, format!("{import_line}\n{decls}")));
    drop_tpl(&mut edits);
    apply(edits)
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
