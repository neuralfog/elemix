//! Splice pre-pass — inline helper templates so the component becomes a single
//! self-contained template.
//!
//! A `${header}` (local `const header = tpl`...``) or `${this.headerTemplate()}`
//! (class member `headerTemplate = () => tpl`...``) embeds a template by
//! reference. Inlining the referenced `tpl`...`` into the hole turns it into a
//! normal nested template, which lowers to a `_child` whose getter reads nothing
//! reactive — so it builds once (a one-time splice) while the built fragment
//! stays internally reactive. After this pass the component has one outermost
//! template and `rewrite` compiles it the usual way.

use crate::locate::find_html_templates;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, Class, ClassElement, Declaration, Expression, PropertyKey, Statement,
    TaggedTemplateExpression,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType};
use std::collections::HashMap;

/// Inline helper templates. Identity for components without helpers.
pub fn inline_helpers(source: &str) -> String {
    if find_html_templates(source).len() <= 1 {
        return source.to_string();
    }
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();
    let Some(class) = find_class(&ret.program) else {
        return source.to_string();
    };

    // Helper name -> its `tpl`...`` source, and class-member helpers to remove.
    let mut helpers: HashMap<String, String> = HashMap::new();
    let mut member_removals: Vec<(usize, usize)> = Vec::new();
    let mut main: Option<MainTemplate> = None;

    for element in &class.body.body {
        let ClassElement::PropertyDefinition(prop) = element else {
            continue;
        };
        let PropertyKey::StaticIdentifier(key) = &prop.key else {
            continue;
        };
        let Some(Expression::ArrowFunctionExpression(arrow)) = &prop.value else {
            continue;
        };

        if key.name == "template" {
            main = analyze_main(arrow, source);
        } else if let Some(html) = expression_html(arrow) {
            helpers.insert(key.name.to_string(), slice(source, html.span()));
            member_removals.push((prop.span.start as usize, prop.span.end as usize));
        }
    }

    let Some(main) = main else {
        return source.to_string();
    };
    helpers.extend(main.local_helpers);

    let inlined = reconstruct(&main.statics, &main.holes, &helpers);

    // Apply edits back-to-front.
    let mut edits: Vec<(usize, usize, String)> = vec![(main.body.0, main.body.1, inlined)];
    for (s, e) in member_removals {
        let e = e + trailing_newline(source, e);
        edits.push((s, e, String::new()));
    }
    edits.sort_by_key(|e| std::cmp::Reverse(e.0));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

struct MainTemplate {
    statics: Vec<String>,
    holes: Vec<String>,
    body: (usize, usize),
    local_helpers: HashMap<String, String>,
}

/// Pull the main template's statics/holes, the body span to replace, and any
/// local `const X = tpl`...`` helpers from the `template` arrow.
fn analyze_main(arrow: &ArrowFunctionExpression, source: &str) -> Option<MainTemplate> {
    // Expression body: `() => tpl`...``
    if let Some(html) = expression_html(arrow) {
        let (statics, holes) = extract(html, source);
        return Some(MainTemplate {
            statics,
            holes,
            body: (html.span().start as usize, html.span().end as usize),
            local_helpers: HashMap::new(),
        });
    }

    // Block body: `() => { const X = tpl`...`; ...; return tpl`...`; }`
    let mut local_helpers = HashMap::new();
    let mut main = None;
    for stmt in &arrow.body.statements {
        match stmt {
            Statement::VariableDeclaration(decl) => {
                for d in &decl.declarations {
                    if let (Some(name), Some(Expression::TaggedTemplateExpression(html))) =
                        (d.id.get_identifier_name(), &d.init)
                    {
                        if is_html(html, source) {
                            local_helpers.insert(name.to_string(), slice(source, html.span()));
                        }
                    }
                }
            }
            Statement::ReturnStatement(ret) => {
                if let Some(Expression::TaggedTemplateExpression(html)) = &ret.argument {
                    if is_html(html, source) {
                        main = Some(html);
                    }
                }
            }
            _ => {}
        }
    }
    let html = main?;
    let (statics, holes) = extract(html, source);
    Some(MainTemplate {
        statics,
        holes,
        // replace the whole `{ ... }` block with the inlined expression html
        body: (arrow.body.span.start as usize, arrow.body.span.end as usize),
        local_helpers,
    })
}

/// The `tpl`...`` of an expression-bodied arrow `() => tpl`...``.
fn expression_html<'a>(
    arrow: &'a ArrowFunctionExpression<'a>,
) -> Option<&'a TaggedTemplateExpression<'a>> {
    if !arrow.expression {
        return None;
    }
    let Statement::ExpressionStatement(stmt) = arrow.body.statements.first()? else {
        return None;
    };
    match &stmt.expression {
        Expression::TaggedTemplateExpression(html) => Some(html),
        _ => None,
    }
}

fn is_html(html: &TaggedTemplateExpression, source: &str) -> bool {
    matches!(&html.tag, Expression::Identifier(id) if slice(source, id.span) == "tpl")
}

/// Statics + hole expressions of a template, sliced from source.
fn extract(html: &TaggedTemplateExpression, source: &str) -> (Vec<String>, Vec<String>) {
    let statics = html
        .quasi
        .quasis
        .iter()
        .map(|q| slice(source, q.span))
        .collect();
    let holes = html
        .quasi
        .expressions
        .iter()
        .map(|e| slice(source, e.span()))
        .collect();
    (statics, holes)
}

/// Rebuild a `tpl`...`` literal, substituting helper-reference holes with the
/// referenced template's source.
fn reconstruct(statics: &[String], holes: &[String], helpers: &HashMap<String, String>) -> String {
    let mut out = String::from("tpl`");
    for (i, s) in statics.iter().enumerate() {
        out.push_str(s);
        if let Some(hole) = holes.get(i) {
            let expr = resolve(hole, helpers).unwrap_or(hole);
            out.push_str("${");
            out.push_str(expr);
            out.push('}');
        }
    }
    out.push('`');
    out
}

/// Map a `${header}` / `${this.headerTemplate()}` hole to its helper source.
fn resolve<'a>(hole: &str, helpers: &'a HashMap<String, String>) -> Option<&'a String> {
    let h = hole.trim();
    if let Some(src) = helpers.get(h) {
        return Some(src);
    }
    let name = h.strip_prefix("this.")?.strip_suffix("()")?.trim();
    helpers.get(name)
}

fn slice(source: &str, span: oxc_span::Span) -> String {
    source[span.start as usize..span.end as usize].to_string()
}

fn find_class<'a>(program: &'a oxc_ast::ast::Program<'a>) -> Option<&'a Class<'a>> {
    for stmt in &program.body {
        match stmt {
            Statement::ExportNamedDeclaration(export) => {
                if let Some(Declaration::ClassDeclaration(class)) = &export.declaration {
                    return Some(class);
                }
            }
            Statement::ClassDeclaration(class) => return Some(class),
            _ => {}
        }
    }
    None
}

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
