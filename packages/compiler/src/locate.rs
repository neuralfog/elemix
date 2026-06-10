//! Stage 1 — locate `tpl` tagged templates and discover source files.

use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, TaggedTemplateExpression};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};
use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq)]
pub struct FoundTemplate {
    pub statics: Vec<String>,
    pub holes: Vec<String>,
}

struct Finder<'s> {
    source: &'s str,
    out: Vec<FoundTemplate>,
}

impl Finder<'_> {
    fn slice(&self, span: Span) -> String {
        self.source[span.start as usize..span.end as usize].to_string()
    }
}

/// Find every `` tpl`...` `` tagged template in `source` and return its static
/// strings + hole expressions (verbatim source slices).
pub fn find_html_templates(source: &str) -> Vec<FoundTemplate> {
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
                    .map(|e| self.slice(e.span()))
                    .collect();
                self.out.push(FoundTemplate { statics, holes });
                // Outermost-only: nested `tpl` templates live inside this one's
                // hole expressions and are lowered by the codegen from there.
                return;
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }
}

/// Expand directories/globs into a sorted, de-duplicated list of `.ts` files.
pub fn collect_ts_files(patterns: &[String]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for pattern in patterns {
        let glob_pattern = if Path::new(pattern).is_dir() {
            format!("{}/**/*.ts", pattern.trim_end_matches('/'))
        } else {
            pattern.clone()
        };
        let Ok(entries) = glob::glob(&glob_pattern) else {
            continue;
        };
        for entry in entries.flatten() {
            if entry.extension().is_some_and(|e| e == "ts") {
                files.push(entry);
            }
        }
    }
    files.sort();
    files.dedup();
    files
}
