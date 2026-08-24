use crate::template::parse::ssr_nested_tpl;
use oxc_allocator::Allocator;
use oxc_ast::ast::{CallExpression, Expression, TaggedTemplateExpression};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

const DIRECTIVES: &[(&str, &str)] = &[
    ("repeat", "$__ssrRepeat"),
    ("when", "$__ssrWhen"),
    ("choose", "$__ssrChoose"),
    ("match", "$__ssrMatch"),
];

struct Edit {
    start: usize,
    end: usize,
    repl: String,
}

struct Rewriter<'s> {
    source: &'s str,
    edits: Vec<Edit>,
}

impl Rewriter<'_> {
    fn slice(&self, span: Span) -> &str {
        &self.source[span.start as usize..span.end as usize]
    }
}

impl<'a> Visit<'a> for Rewriter<'_> {
    fn visit_tagged_template_expression(&mut self, it: &TaggedTemplateExpression<'a>) {
        if let Expression::Identifier(ident) = &it.tag {
            if self.slice(ident.span) == "tpl" {
                let statics = it
                    .quasi
                    .quasis
                    .iter()
                    .map(|q| self.slice(q.span).to_string());
                let holes = it
                    .quasi
                    .expressions
                    .iter()
                    .map(|e| self.slice(e.span()).to_string());
                let repl = ssr_nested_tpl(&statics.collect::<Vec<_>>(), &holes.collect::<Vec<_>>());
                self.edits.push(Edit {
                    start: it.span.start as usize,
                    end: it.span.end as usize,
                    repl,
                });
                return;
            }
        }
        walk::walk_tagged_template_expression(self, it);
    }

    fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
        if let Expression::Identifier(ident) = &it.callee {
            let name = self.slice(ident.span);
            if let Some((_, ssr)) = DIRECTIVES.iter().find(|(d, _)| *d == name) {
                self.edits.push(Edit {
                    start: ident.span.start as usize,
                    end: ident.span.end as usize,
                    repl: (*ssr).to_string(),
                });
            }
        }
        walk::walk_call_expression(self, it);
    }
}

pub fn rewrite_content_expr(expr: &str) -> String {
    let wrapped = format!("({expr})");
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, &wrapped, SourceType::ts()).parse();

    let mut r = Rewriter {
        source: &wrapped,
        edits: Vec::new(),
    };
    r.visit_program(&ret.program);

    r.edits.sort_by_key(|e| std::cmp::Reverse(e.start));
    let mut out = wrapped.clone();
    for e in &r.edits {
        out.replace_range(e.start..e.end, &e.repl);
    }
    out
}
