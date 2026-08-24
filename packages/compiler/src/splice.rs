use crate::locate::find_html_templates;
use crate::lower::{
    apply_edits, is_ident_char, skip_string, skip_to_close, split_commas, split_template_literal,
    tl_end, trailing_newline,
};
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, Class, ClassElement, Declaration, Expression, MethodDefinitionKind,
    PropertyKey, Statement, TaggedTemplateExpression,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType};
use std::collections::HashMap;

struct Helper {
    params: Vec<String>,
    source: String,
}

fn arrow_params(arrow: &ArrowFunctionExpression) -> Vec<String> {
    arrow
        .params
        .items
        .iter()
        .filter_map(|p| p.pattern.get_identifier_name().map(|n| n.to_string()))
        .collect()
}

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

    apply_edits(source, edits)
}

fn class_edits(source: &str, class: &Class, edits: &mut Vec<(usize, usize, String)>) {
    let mut helpers: HashMap<String, Helper> = HashMap::new();
    let mut member_removals: Vec<(usize, usize)> = Vec::new();
    let mut main: Option<MainTemplate> = None;

    for element in &class.body.body {
        match element {
            ClassElement::PropertyDefinition(prop) => {
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
            ClassElement::MethodDefinition(m)
                if m.kind == MethodDefinitionKind::Method
                    && matches!(&m.key, PropertyKey::StaticIdentifier(k) if k.name == "template") =>
            {
                if let Some(body) = &m.value.body {
                    let (locals, const_removals, ret) = collect_block(&body.statements, source);
                    if let Some(html) = ret {
                        let (statics, holes) = extract(html, source);
                        main = Some(MainTemplate {
                            statics,
                            holes,
                            body: (html.span().start as usize, html.span().end as usize),
                            local_helpers: locals,
                        });
                        for (s, e) in const_removals {
                            let e = e + trailing_newline(source, e);
                            edits.push((s, e, String::new()));
                        }
                    }
                }
            }
            _ => {}
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

fn analyze_main(arrow: &ArrowFunctionExpression, source: &str) -> Option<MainTemplate> {
    if let Some(html) = expression_html(arrow) {
        let (statics, holes) = extract(html, source);
        return Some(MainTemplate {
            statics,
            holes,
            body: (html.span().start as usize, html.span().end as usize),
            local_helpers: HashMap::new(),
        });
    }

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
        body: (arrow.body.span.start as usize, arrow.body.span.end as usize),
        local_helpers,
    })
}

type BlockParts<'a> = (
    HashMap<String, Helper>,
    Vec<(usize, usize)>,
    Option<&'a TaggedTemplateExpression<'a>>,
);

fn collect_block<'a>(statements: &'a [Statement<'a>], source: &str) -> BlockParts<'a> {
    let mut local_helpers = HashMap::new();
    let mut const_removals = Vec::new();
    let mut ret = None;
    for stmt in statements {
        match stmt {
            Statement::VariableDeclaration(decl) => {
                let mut has_helper = false;
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
                            has_helper = true;
                        }
                    }
                }
                if has_helper {
                    const_removals.push((decl.span.start as usize, decl.span.end as usize));
                }
            }
            Statement::ReturnStatement(r) => {
                if let Some(Expression::TaggedTemplateExpression(html)) = &r.argument {
                    if is_html(html, source) {
                        ret = Some(&**html);
                    }
                }
            }
            _ => {}
        }
    }
    (local_helpers, const_removals, ret)
}

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

fn inline_hole(hole: &str, helpers: &HashMap<String, Helper>) -> String {
    if let Some(h) = helpers.get(hole.trim()) {
        if h.params.is_empty() {
            return h.source.clone();
        }
    }
    inline_calls(hole, helpers)
}

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
            let lit: String = c[i..j].iter().collect();
            out.push_str(&inline_template_literal(&lit, helpers));
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

fn inline_template_literal(lit: &str, helpers: &HashMap<String, Helper>) -> String {
    let (statics, holes) = split_template_literal(lit);
    let mut out = String::from("`");
    for (i, s) in statics.iter().enumerate() {
        out.push_str(s);
        if let Some(hole) = holes.get(i) {
            out.push_str("${");
            out.push_str(&inline_calls(hole, helpers));
            out.push('}');
        }
    }
    out.push('`');
    out
}

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
    let close = skip_to_close(c, k + 1, ')');
    let args = split_commas(&c[k + 1..close - 1].iter().collect::<String>());
    Some((close, inline_helper(helper, &args)))
}

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
