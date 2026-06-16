//! Stage: locate `//` pragma comments and bind each to the declaration on the
//! next line.
//!
//! Walks `program.comments`, keeps the line comments whose content is a pragma
//! (`#…`), and binds each to the nearest following declaration that sits on the
//! *immediately* next line (no blank line between):
//! - on a class → `#component`/`#tag`/`#form` directives;
//! - on a class **field** → `#styles` (the field value is the stylesheet,
//!   inlined into `sheet(...)` and the field stripped);
//! - on a class field **or** module `const` → `#state` (wrap the initializer in
//!   `state<T>(…)`, lifting the type annotation into the generic).
//!
//! The values stay real, type-checked expressions on the declaration — never
//! text in the comment.

use crate::pragma::parse::{is_pragma, split_directives};
use crate::pragma::Directive;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPattern, Class, ClassElement, Declaration, MethodDefinitionKind, PropertyKey, Statement,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// A `#styles`-tagged class field: its initializer text (the value passed to
/// `sheet`) and the source range to strip (the marker comment + the field line).
#[derive(Debug, PartialEq)]
pub struct StyleField {
    pub value: String,
    pub strip: (usize, usize),
}

/// A `#state` rewrite: replace `[start, end)` (from the binding name's end through
/// the initializer's end) with ` = state<T>(init)`.
#[derive(Debug, PartialEq)]
pub struct StateEdit {
    pub start: usize,
    pub end: usize,
    pub repl: String,
}

/// A top-level class with whatever pragma directives + styles fields tag it.
#[derive(Debug, PartialEq)]
pub struct ClassInfo {
    pub name: String,
    /// Start of the class statement (`export`-inclusive) — hoist consts here.
    pub start: usize,
    /// End of the class statement — append `defineComponent(...)` after here.
    pub end: usize,
    /// Offset just inside the class body `{` — inject `#form`'s member here.
    pub body_open: usize,
    pub directives: Vec<Directive>,
    pub styles: Vec<StyleField>,
    pub effects: Vec<String>,
}

/// Everything the lowering needs. `#state` declarations resolve `state` from
/// `@neuralfog/elemix/runtime` (a compile target), so no public-import surgery.
#[derive(Debug, PartialEq)]
pub struct Located {
    pub classes: Vec<ClassInfo>,
    pub states: Vec<StateEdit>,
    pub strips: Vec<(usize, usize)>,
}

#[derive(Debug, PartialEq)]
pub enum LocateError {
    /// A pragma comment with no declaration on the immediately-following line.
    Orphan,
    /// A non-`#state` directive tagging a top-level `const`.
    OnConst(String),
    /// A non-`#styles`/`#state` directive tagging a class field.
    OnField(String),
}

/// What a pragma comment binds to.
enum Kind {
    Class(usize),
    Field {
        class_idx: usize,
        name: String,
        name_end: usize,
        type_span: Option<Span>,
        value: Span,
        prop_end: usize,
    },
    Method {
        class_idx: usize,
        name: String,
    },
    Const {
        name_end: usize,
        type_span: Option<Span>,
        value: Span,
    },
}

/// Find every pragma comment and bind it to the next-line declaration.
pub fn locate(source: &str) -> Result<Located, LocateError> {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    let mut classes: Vec<ClassInfo> = Vec::new();
    let mut targets: Vec<(usize, Kind)> = Vec::new();

    for stmt in &ret.program.body {
        if let Some((class, stmt_start)) = as_class(stmt) {
            let Some(id) = class.id.as_ref() else {
                continue;
            };
            let idx = classes.len();
            targets.push((stmt_start, Kind::Class(idx)));
            for el in &class.body.body {
                match el {
                    ClassElement::PropertyDefinition(prop) => {
                        if let Some(value) = &prop.value {
                            targets.push((
                                prop.span.start as usize,
                                Kind::Field {
                                    class_idx: idx,
                                    name: key_name(&prop.key),
                                    name_end: prop.key.span().end as usize,
                                    type_span: prop
                                        .type_annotation
                                        .as_ref()
                                        .map(|t| t.type_annotation.span()),
                                    value: value.span(),
                                    prop_end: prop.span.end as usize,
                                },
                            ));
                        }
                    }
                    ClassElement::MethodDefinition(m) if m.kind == MethodDefinitionKind::Method => {
                        targets.push((
                            m.span.start as usize,
                            Kind::Method {
                                class_idx: idx,
                                name: key_name(&m.key),
                            },
                        ));
                    }
                    _ => {}
                }
            }
            classes.push(ClassInfo {
                name: id.name.to_string(),
                start: stmt_start,
                end: class.span.end as usize,
                body_open: class.body.span.start as usize + 1,
                directives: Vec::new(),
                styles: Vec::new(),
                effects: Vec::new(),
            });
        } else if let Some(target) = as_const(stmt) {
            targets.push(target);
        }
    }
    targets.sort_by_key(|(start, _)| *start);

    let mut states: Vec<StateEdit> = Vec::new();
    let mut strips: Vec<(usize, usize)> = Vec::new();

    for c in &ret.program.comments {
        if !c.is_line() {
            continue;
        }
        let content = slice(source, c.content_span());
        if !is_pragma(&content) {
            continue;
        }
        let directives = split_directives(&content);
        let cstart = c.span.start as usize;
        let cend = c.span.end as usize;
        let line = line_start(source, cstart);

        let target = targets
            .iter()
            .filter(|(start, _)| *start >= cend)
            .min_by_key(|(start, _)| *start);
        let Some((start, kind)) = target else {
            return Err(LocateError::Orphan);
        };
        if !immediately_next_line(source, cend, *start) {
            return Err(LocateError::Orphan);
        }

        match kind {
            Kind::Class(idx) => {
                classes[*idx].directives.extend(directives);
                strips.push((line, cend));
            }
            Kind::Field {
                class_idx,
                name,
                name_end,
                type_span,
                value,
                prop_end,
            } => match directive_name(&directives)? {
                "styles" => classes[*class_idx].styles.push(StyleField {
                    value: slice(source, *value),
                    strip: (line, field_block_end(source, *prop_end)),
                }),
                "state" => {
                    states.push(state_edit(source, *name_end, *type_span, *value));
                    strips.push((line, cend));
                }
                "effect" => {
                    classes[*class_idx].effects.push(name.clone());
                    strips.push((line, cend));
                }
                other => return Err(LocateError::OnField(other.to_string())),
            },
            Kind::Method { class_idx, name } => match directive_name(&directives)? {
                "effect" => {
                    classes[*class_idx].effects.push(name.clone());
                    strips.push((line, cend));
                }
                other => return Err(LocateError::OnField(other.to_string())),
            },
            Kind::Const {
                name_end,
                type_span,
                value,
            } => match directive_name(&directives)? {
                "state" => {
                    states.push(state_edit(source, *name_end, *type_span, *value));
                    strips.push((line, cend));
                }
                other => return Err(LocateError::OnConst(other.to_string())),
            },
        }
    }

    Ok(Located {
        classes,
        states,
        strips,
    })
}

/// The identifier name of a member key (empty for computed keys).
fn key_name(key: &PropertyKey) -> String {
    match key {
        PropertyKey::StaticIdentifier(id) => id.name.to_string(),
        _ => String::new(),
    }
}

/// The single directive name a field/const pragma carries (they take exactly one).
fn directive_name(directives: &[Directive]) -> Result<&str, LocateError> {
    match directives {
        [d] => Ok(d.name.as_str()),
        _ => Err(LocateError::OnField("(expected one directive)".to_string())),
    }
}

/// `[name_end, value_end)` → ` = state<Type>(value)` (generic omitted if untyped).
fn state_edit(source: &str, name_end: usize, type_span: Option<Span>, value: Span) -> StateEdit {
    let generic = type_span.map_or(String::new(), |t| format!("<{}>", slice(source, t)));
    StateEdit {
        start: name_end,
        end: value.end as usize,
        repl: format!(" = state{generic}({})", slice(source, value)),
    }
}

/// The class and its statement start (`export`-inclusive) for a (possibly
/// exported) class declaration.
fn as_class<'a, 'b>(stmt: &'a Statement<'b>) -> Option<(&'a Class<'b>, usize)> {
    match stmt {
        Statement::ClassDeclaration(c) => {
            let class: &Class = c;
            Some((class, c.span.start as usize))
        }
        Statement::ExportNamedDeclaration(e) => match &e.declaration {
            Some(Declaration::ClassDeclaration(c)) => {
                let class: &Class = c;
                Some((class, e.span.start as usize))
            }
            _ => None,
        },
        _ => None,
    }
}

/// A simple top-level `const NAME: T = init` (or `export const …`) as a `#state`
/// target. The statement start keys the next-line binding; the binding-name end,
/// type, and initializer drive the rewrite.
fn as_const(stmt: &Statement) -> Option<(usize, Kind)> {
    let (decl, stmt_start) = match stmt {
        Statement::VariableDeclaration(v) => (v.as_ref(), v.span.start as usize),
        Statement::ExportNamedDeclaration(export) => match &export.declaration {
            Some(Declaration::VariableDeclaration(v)) => (v.as_ref(), export.span.start as usize),
            _ => return None,
        },
        _ => return None,
    };
    let first = decl.declarations.first()?;
    let BindingPattern::BindingIdentifier(id) = &first.id else {
        return None;
    };
    let value = first.init.as_ref()?.span();
    Some((
        stmt_start,
        Kind::Const {
            name_end: id.span.end as usize,
            type_span: first
                .type_annotation
                .as_ref()
                .map(|t| t.type_annotation.span()),
            value,
        },
    ))
}

/// Whether `to` sits on the line immediately after the comment ending at `from`
/// — the gap is whitespace with exactly one newline.
fn immediately_next_line(source: &str, from: usize, to: usize) -> bool {
    let gap = &source[from..to];
    gap.chars().all(char::is_whitespace) && gap.matches('\n').count() == 1
}

/// Start of the line containing `at`.
fn line_start(source: &str, at: usize) -> usize {
    source[..at].rfind('\n').map_or(0, |i| i + 1)
}

/// End of a field statement starting after its value at `prop_end`: past the
/// trailing whitespace, an optional `;`, and the line's newline.
fn field_block_end(source: &str, prop_end: usize) -> usize {
    let bytes = source.as_bytes();
    let mut i = prop_end;
    while i < bytes.len() && matches!(bytes[i], b' ' | b'\t') {
        i += 1;
    }
    if i < bytes.len() && bytes[i] == b';' {
        i += 1;
    }
    while i < bytes.len() && bytes[i] != b'\n' {
        i += 1;
    }
    if i < bytes.len() {
        i += 1;
    }
    i
}

fn slice(source: &str, span: Span) -> String {
    source[span.start as usize..span.end as usize].to_string()
}
