//! Stage: locate pragma blocks and bind each to its class.
//!
//! Walks the module body, buffering contiguous bare-template pragma statements
//! and flushing them onto the next `class` declaration. The generic split lives
//! in [`super::parse`]; this layer only does the oxc detection + association and
//! records the source spans the lowering needs (the statements to strip, and
//! where the class begins/ends).

use crate::pragma::parse::{is_pragma, split_directives};
use crate::pragma::Directive;
use oxc_allocator::Allocator;
use oxc_ast::ast::{Declaration, Expression, Statement, TemplateLiteral};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// A pragma block bound to its component class.
#[derive(Debug, PartialEq)]
pub struct LocatedBlock {
    pub directives: Vec<Directive>,
    pub class_name: String,
    /// Start of the class statement (`export`-inclusive) — insert hoisted
    /// consts before here.
    pub class_start: usize,
    /// End of the class statement — append `defineComponent(...)` after here.
    pub class_end: usize,
    /// Offset just inside the class body `{` — inject members (e.g. `#form`'s
    /// `formAssociated`/`internals`) here.
    pub class_body_open: usize,
    /// Span covering the pragma statements, to strip from the output.
    pub block_start: usize,
    pub block_end: usize,
}

#[derive(Debug, PartialEq)]
pub enum LocateError {
    /// A pragma block with no `class` declaration directly below it.
    Orphan,
}

/// Find every pragma block and the class it attaches to.
pub fn locate(source: &str) -> Result<Vec<LocatedBlock>, LocateError> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut blocks = Vec::new();
    let mut buf: Vec<Directive> = Vec::new();
    let mut buf_start: Option<usize> = None;
    let mut buf_end = 0usize;

    for stmt in &ret.program.body {
        if let Some((dirs, span)) = pragma_statement(source, stmt) {
            if buf_start.is_none() {
                buf_start = Some(span.start as usize);
            }
            buf_end = span.end as usize;
            buf.extend(dirs);
            continue;
        }
        if let Some((class_name, class_start, class_end, class_body_open)) = class_info(stmt) {
            if let Some(block_start) = buf_start.take() {
                blocks.push(LocatedBlock {
                    directives: std::mem::take(&mut buf),
                    class_name,
                    class_start,
                    class_end,
                    class_body_open,
                    block_start,
                    block_end: buf_end,
                });
            }
            continue;
        }
        // Any other statement while pragmas are pending breaks the block.
        if buf_start.is_some() {
            return Err(LocateError::Orphan);
        }
    }
    if buf_start.is_some() {
        return Err(LocateError::Orphan);
    }
    Ok(blocks)
}

/// If `stmt` is a pragma statement, split it into directives with its span.
///
/// Two source shapes collapse to the same thing here:
/// * one literal — `` `#a #b ${x}` `` (one line, or `;`-terminated lines), and
/// * a no-semicolon multi-line block — `` `#a`\n`#b ${x}` `` — which JS parses
///   as a *chained* tagged template (each literal tags the next). We flatten the
///   chain left-to-right so both yield the same ordered directive list.
fn pragma_statement(source: &str, stmt: &Statement) -> Option<(Vec<Directive>, Span)> {
    let Statement::ExpressionStatement(es) = stmt else {
        return None;
    };
    let mut chain: Vec<&TemplateLiteral> = Vec::new();
    if !collect_chain(&es.expression, &mut chain) {
        return None;
    }
    let first_quasi = chain.first()?.quasis.first()?;
    if !is_pragma(&slice(source, first_quasi.span)) {
        return None;
    }
    let mut directives = Vec::new();
    for tl in chain {
        let statics: Vec<String> = tl.quasis.iter().map(|q| slice(source, q.span)).collect();
        let holes: Vec<String> = tl
            .expressions
            .iter()
            .map(|e| slice(source, e.span()))
            .collect();
        directives.extend(split_directives(&statics, &holes));
    }
    Some((directives, es.span))
}

/// Flatten a (possibly chained) template literal into its literals in source
/// order. `` `a` `` → `[a]`; `` `a`\n`b`\n`c` `` parses as `((`a``b``)`c`)` →
/// recurse the tag, then append the quasi → `[a, b, c]`. Returns false if the
/// chain bottoms out in anything other than a template literal (e.g. a `tpl`
/// tag, which is an identifier — not a pragma).
fn collect_chain<'a, 'b>(expr: &'a Expression<'b>, out: &mut Vec<&'a TemplateLiteral<'b>>) -> bool {
    match expr {
        Expression::TemplateLiteral(tl) => {
            out.push(tl);
            true
        }
        Expression::TaggedTemplateExpression(tt) => {
            collect_chain(&tt.tag, out) && {
                out.push(&tt.quasi);
                true
            }
        }
        _ => false,
    }
}

/// The class name, statement span, and body-open offset (just past `{`) for a
/// (possibly exported) class declaration.
fn class_info(stmt: &Statement) -> Option<(String, usize, usize, usize)> {
    match stmt {
        Statement::ClassDeclaration(class) => {
            let name = class.id.as_ref()?.name.to_string();
            Some((
                name,
                class.span.start as usize,
                class.span.end as usize,
                class.body.span.start as usize + 1,
            ))
        }
        Statement::ExportNamedDeclaration(export) => {
            let Some(Declaration::ClassDeclaration(class)) = &export.declaration else {
                return None;
            };
            let name = class.id.as_ref()?.name.to_string();
            Some((
                name,
                export.span.start as usize,
                export.span.end as usize,
                class.body.span.start as usize + 1,
            ))
        }
        _ => None,
    }
}

fn slice(source: &str, span: Span) -> String {
    source[span.start as usize..span.end as usize].to_string()
}
