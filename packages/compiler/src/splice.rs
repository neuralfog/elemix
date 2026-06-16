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
use crate::lower::{
    is_ident_char, skip_string, skip_to_close, split_commas, split_template_literal, tl_end,
};
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, Class, ClassElement, Declaration, Expression, PropertyKey, Statement,
    TaggedTemplateExpression,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType};
use std::collections::HashMap;

/// A helper template: the `tpl`…`` source plus the parameter names of its arrow
/// (empty for a bare `const x = tpl`…``). A parameterized helper is inlined by
/// substituting each param for the call's argument in the template's holes.
struct Helper {
    params: Vec<String>,
    source: String,
}

/// The simple identifier parameter names of an arrow (`(item, i) => …` → `[item, i]`).
/// Non-identifier params (destructuring) are skipped — they don't substitute.
fn arrow_params(arrow: &ArrowFunctionExpression) -> Vec<String> {
    arrow
        .params
        .items
        .iter()
        .filter_map(|p| p.pattern.get_identifier_name().map(|n| n.to_string()))
        .collect()
}

/// Inline helper templates for EVERY component in the file (helpers are
/// per-class). Identity for components without helpers.
pub fn inline_helpers(source: &str) -> String {
    if find_html_templates(source).len() <= 1 {
        return source.to_string();
    }
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    for class in all_classes(&ret.program) {
        class_edits(source, class, &mut edits);
    }
    if edits.is_empty() {
        return source.to_string();
    }

    // Apply back-to-front. Each class's spans are disjoint, so the order across
    // classes is fine to interleave.
    edits.sort_by_key(|e| std::cmp::Reverse(e.0));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

/// Inline one class's helper templates into its main template, pushing the edits
/// (the rewritten main body + the helper-member removals). No-op for a class
/// without a `template` member.
fn class_edits(source: &str, class: &Class, edits: &mut Vec<(usize, usize, String)>) {
    // Helper name -> its template, and class-member helpers to remove.
    let mut helpers: HashMap<String, Helper> = HashMap::new();
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
            helpers.insert(
                key.name.to_string(),
                Helper {
                    params: arrow_params(arrow),
                    source: slice(source, html.span()),
                },
            );
            member_removals.push((prop.span.start as usize, prop.span.end as usize));
        }
    }

    let Some(main) = main else {
        return;
    };
    helpers.extend(main.local_helpers);

    let inlined = reconstruct(&main.statics, &main.holes, &helpers);
    edits.push((main.body.0, main.body.1, inlined));
    for (s, e) in member_removals {
        let e = e + trailing_newline(source, e);
        edits.push((s, e, String::new()));
    }
}

struct MainTemplate {
    statics: Vec<String>,
    holes: Vec<String>,
    body: (usize, usize),
    local_helpers: HashMap<String, Helper>,
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
                            local_helpers.insert(
                                name.to_string(),
                                Helper {
                                    params: Vec::new(),
                                    source: slice(source, html.span()),
                                },
                            );
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

/// Rebuild a `tpl`...`` literal, inlining helper references in each hole.
fn reconstruct(statics: &[String], holes: &[String], helpers: &HashMap<String, Helper>) -> String {
    let mut out = String::from("tpl`");
    for (i, s) in statics.iter().enumerate() {
        out.push_str(s);
        if let Some(hole) = holes.get(i) {
            out.push_str("${");
            out.push_str(&inline_hole(hole, helpers));
            out.push('}');
        }
    }
    out.push('`');
    out
}

/// Inline helper references in one hole: a bare `${header}` whole-hole reference
/// to a zero-arg helper, or any `[this.]row(args)` helper CALL nested inside the
/// expression (e.g. a `repeat` render). Everything else is left untouched.
fn inline_hole(hole: &str, helpers: &HashMap<String, Helper>) -> String {
    if let Some(h) = helpers.get(hole.trim()) {
        if h.params.is_empty() {
            return h.source.clone();
        }
    }
    inline_calls(hole, helpers)
}

/// Replace every `[this.]NAME(args)` helper call in `expr` with the inlined helper
/// template (its params substituted for the args). String/template contents pass
/// through verbatim, so a `#` or `(` inside them is never mistaken for a call.
fn inline_calls(expr: &str, helpers: &HashMap<String, Helper>) -> String {
    let c: Vec<char> = expr.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < c.len() {
        let ch = c[i];
        if ch == '\'' || ch == '"' {
            let j = skip_string(&c, i, ch);
            out.extend(c[i..j].iter());
            i = j;
        } else if ch == '`' {
            let j = tl_end(&c, i) + 1;
            out.extend(c[i..j].iter());
            i = j;
        } else if is_ident_start(ch) && (i == 0 || !is_ident_char(c[i - 1])) {
            if let Some((end, repl)) = try_call(&c, i, helpers) {
                out.push_str(&repl);
                i = end;
            } else {
                out.push(ch);
                i += 1;
            }
        } else {
            out.push(ch);
            i += 1;
        }
    }
    out
}

/// If a helper call (`row(...)` or `this.row(...)`) begins at `i`, return the
/// index just past its `)` and the inlined template.
fn try_call(c: &[char], i: usize, helpers: &HashMap<String, Helper>) -> Option<(usize, String)> {
    let id_end = read_ident(c, i);
    let first: String = c[i..id_end].iter().collect();
    let (name, after) = if first == "this" && c.get(id_end) == Some(&'.') {
        let ns = id_end + 1;
        let ne = read_ident(c, ns);
        (c[ns..ne].iter().collect::<String>(), ne)
    } else {
        (first, id_end)
    };
    let helper = helpers.get(&name)?;
    let mut k = after;
    while k < c.len() && c[k].is_whitespace() {
        k += 1;
    }
    if c.get(k) != Some(&'(') {
        return None;
    }
    let close = skip_to_close(c, k + 1, ')'); // index just past `)`
    let args = split_commas(&c[k + 1..close - 1].iter().collect::<String>());
    Some((close, inline_helper(helper, &args)))
}

/// Build the helper's `tpl`…`` with each param substituted for the matching arg
/// (identifier-aware) in its holes.
fn inline_helper(helper: &Helper, args: &[String]) -> String {
    let (statics, holes) = split_template_literal(&helper.source);
    let mut out = String::from("tpl`");
    for (i, s) in statics.iter().enumerate() {
        out.push_str(s);
        if let Some(hole) = holes.get(i) {
            let mut h = hole.clone();
            for (param, arg) in helper.params.iter().zip(args) {
                h = rename_ident(&h, param, arg);
            }
            out.push_str("${");
            out.push_str(&h);
            out.push('}');
        }
    }
    out.push('`');
    out
}

/// Rename whole-identifier `from` to `to` in an expression, skipping string +
/// template contents and property names after `.` (so `item.id` → `r.id`, but
/// `x.item` and `'item'` are left alone). NOTE: a name that shadows the param
/// inside its own body (`item => …item…`) would also be renamed — a rare,
/// pathological case we accept rather than do full scope analysis.
fn rename_ident(expr: &str, from: &str, to: &str) -> String {
    let c: Vec<char> = expr.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < c.len() {
        let ch = c[i];
        if ch == '\'' || ch == '"' {
            let j = skip_string(&c, i, ch);
            out.extend(c[i..j].iter());
            i = j;
        } else if ch == '`' {
            let j = tl_end(&c, i) + 1;
            out.extend(c[i..j].iter());
            i = j;
        } else if is_ident_start(ch) && (i == 0 || !is_ident_char(c[i - 1])) {
            let j = read_ident(&c, i);
            let id: String = c[i..j].iter().collect();
            let after_dot = i > 0 && c[i - 1] == '.';
            if id == from && !after_dot {
                out.push_str(to);
            } else {
                out.push_str(&id);
            }
            i = j;
        } else {
            out.push(ch);
            i += 1;
        }
    }
    out
}

fn is_ident_start(ch: char) -> bool {
    ch.is_alphabetic() || ch == '_' || ch == '$'
}

fn read_ident(c: &[char], from: usize) -> usize {
    let mut j = from;
    while j < c.len() && is_ident_char(c[j]) {
        j += 1;
    }
    j
}

fn slice(source: &str, span: oxc_span::Span) -> String {
    source[span.start as usize..span.end as usize].to_string()
}

fn all_classes<'a>(program: &'a oxc_ast::ast::Program<'a>) -> Vec<&'a Class<'a>> {
    let mut classes = Vec::new();
    for stmt in &program.body {
        match stmt {
            Statement::ExportNamedDeclaration(export) => {
                if let Some(Declaration::ClassDeclaration(class)) = &export.declaration {
                    classes.push(&**class);
                }
            }
            Statement::ClassDeclaration(class) => classes.push(&**class),
            _ => {}
        }
    }
    classes
}

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
