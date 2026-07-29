//! SSR lowering of a directive / nested-template content-hole expression.
//!
//! A non-text content hole (`repeat`/`when`/`choose`/`match`, a ternary over
//! `` tpl`…` ``, or a bare nested `` tpl`…` ``) can't reach the server as-is: the
//! directives are compile-time markers that throw at runtime, and a nested `tpl`
//! would otherwise be lowered to the CSR `$__clone` DOM builder (which has no DOM
//! server-side). This pass rewrites the expression into a STRING-producing one:
//!
//!   * each directive callee `repeat`/`when`/`choose`/`match` → its string
//!     builder `$__ssrRepeat`/`$__ssrWhen`/`$__ssrChoose`/`$__ssrMatch`;
//!   * each nested `` tpl`…` `` → its SSR string literal (via
//!     [`crate::template::parse::ssr_nested_tpl`], which recurses back here for
//!     that template's own content holes).
//!
//! Everything else in the expression is preserved verbatim, so the callbacks,
//! conditions and member accesses run exactly as written - only now producing
//! strings. A component reached through a directive still lowers to `$__ssrChild`
//! (the nested-`tpl` serializer emits it), so it SSRs and self-hydrates.

use crate::template::parse::ssr_nested_tpl;
use oxc_allocator::Allocator;
use oxc_ast::ast::{CallExpression, Expression, TaggedTemplateExpression};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// (`directive`, its SSR string-builder). `match` has two arities; the builder
/// dispatches on `arguments.length` at runtime, so one name covers both.
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
                // The nested template is fully serialized (its own content holes
                // recurse through `rewrite_content_expr`), so do NOT walk into it -
                // that would double-process the same source.
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
        // Walk the arguments: the callbacks hold the `tpl` templates to serialize.
        walk::walk_call_expression(self, it);
    }
}

/// Rewrite one content-hole expression to a string-producing expression. Wraps in
/// parens so the parse always yields a single expression; the parens are harmless
/// in the `${…}` emit site and keep the result a valid grouped expression.
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
