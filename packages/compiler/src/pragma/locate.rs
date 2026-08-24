use crate::pragma::is_known_directive;
use crate::pragma::parse::{is_pragma, split_directives, split_directives_spanned};
use crate::pragma::Directive;
use crate::pragma::SpannedDirective;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPattern, Class, ClassElement, Declaration, Expression, MethodDefinitionKind,
    PropertyKey, Statement,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

#[derive(Debug, PartialEq)]
pub struct StyleField {
    pub value: String,
    pub strip: (usize, usize),
    pub comment: (usize, usize),
}

#[derive(Debug, PartialEq)]
pub struct StateEdit {
    pub start: usize,
    pub end: usize,
    pub repl: String,
    pub accessor: bool,
    pub module_primitive: bool,
    pub module: bool,
    pub store_name: Option<String>,
}

#[derive(Debug, PartialEq)]
pub struct ClassInfo {
    pub name: String,
    pub start: usize,
    pub end: usize,
    pub body_open: usize,
    pub directives: Vec<Directive>,
    pub directive_spans: Vec<SpannedDirective>,
    pub styles: Vec<StyleField>,
    pub document_field: Option<StyleField>,
    pub effects: Vec<String>,
    pub before_mounts: Vec<String>,
    pub mounts: Vec<String>,
    pub disposes: Vec<String>,
    pub super_class: Option<String>,
}

impl ClassInfo {
    pub fn has_pragmas(&self) -> bool {
        !self.directives.is_empty()
            || !self.styles.is_empty()
            || self.document_field.is_some()
            || !self.effects.is_empty()
            || !self.before_mounts.is_empty()
            || !self.mounts.is_empty()
            || !self.disposes.is_empty()
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum BindingProblem {
    HookOnNonFunction,
    StateOnFunction,
    StateOnMethod,
}

#[derive(Debug, PartialEq)]
pub struct BindingIssue {
    pub directive: String,
    pub member: String,
    pub class: String,
    pub problem: BindingProblem,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, PartialEq)]
pub struct Located {
    pub classes: Vec<ClassInfo>,
    pub states: Vec<StateEdit>,
    pub strips: Vec<(usize, usize)>,
    pub binding_issues: Vec<BindingIssue>,
}

#[derive(Debug, PartialEq)]
pub enum LocateError {
    Orphan,
    OnConst(String),
    OnField(String),
    Unknown(String),
    MissingName(String),
}

#[derive(Debug, PartialEq)]
pub struct LocatedError {
    pub err: LocateError,
    pub span: Option<(usize, usize)>,
    pub component: Option<String>,
}

impl From<LocateError> for LocatedError {
    fn from(err: LocateError) -> Self {
        LocatedError {
            err,
            span: None,
            component: None,
        }
    }
}

enum Kind {
    Class(usize),
    Field {
        class_idx: usize,
        name: String,
        name_start: usize,
        name_end: usize,
        type_span: Option<Span>,
        value: Span,
        prop_end: usize,
        value_is_fn: bool,
    },
    Method {
        class_idx: usize,
        name: String,
        name_start: usize,
        name_end: usize,
    },
    Const {
        name_start: usize,
        name_end: usize,
        type_span: Option<Span>,
        value: Span,
    },
}

pub fn locate(source: &str) -> Result<Located, LocatedError> {
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
                                    name_start: prop.span.start as usize,
                                    name_end: prop.key.span().end as usize,
                                    type_span: prop
                                        .type_annotation
                                        .as_ref()
                                        .map(|t| t.type_annotation.span()),
                                    value: value.span(),
                                    prop_end: prop.span.end as usize,
                                    value_is_fn: matches!(
                                        value,
                                        Expression::ArrowFunctionExpression(_)
                                            | Expression::FunctionExpression(_)
                                    ),
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
                                name_start: m.key.span().start as usize,
                                name_end: m.key.span().end as usize,
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
                directive_spans: Vec::new(),
                styles: Vec::new(),
                document_field: None,
                effects: Vec::new(),
                before_mounts: Vec::new(),
                mounts: Vec::new(),
                disposes: Vec::new(),
                super_class: class.super_class.as_ref().and_then(|e| match e {
                    Expression::Identifier(id) => Some(id.name.to_string()),
                    _ => None,
                }),
            });
        } else if let Some(target) = as_const(stmt) {
            targets.push(target);
        }
    }
    targets.sort_by_key(|(start, _)| *start);

    let mut states: Vec<StateEdit> = Vec::new();
    let mut strips: Vec<(usize, usize)> = Vec::new();
    let mut binding_issues: Vec<BindingIssue> = Vec::new();

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
            return Err(LocateError::Orphan.into());
        };
        if !immediately_next_line(source, cend, *start) {
            return Err(LocateError::Orphan.into());
        }

        match kind {
            Kind::Class(idx) => {
                classes[*idx].directives.extend(directives);
                classes[*idx]
                    .directive_spans
                    .extend(split_directives_spanned(
                        &content,
                        c.content_span().start as usize,
                    ));
                strips.push((line, cend));
            }
            Kind::Field {
                class_idx,
                name,
                name_start,
                name_end,
                type_span,
                value,
                prop_end,
                value_is_fn,
            } => match directive_name(&directives).map_err(|err| LocatedError {
                err,
                span: Some((*name_start, *name_end)),
                component: Some(classes[*class_idx].name.clone()),
            })? {
                "styles" => classes[*class_idx].styles.push(StyleField {
                    value: slice(source, *value),
                    strip: (line, field_block_end(source, *prop_end)),
                    comment: (line, cend + usize::from(source[cend..].starts_with('\n'))),
                }),
                "document" => {
                    classes[*class_idx].document_field = Some(StyleField {
                        value: slice(source, *value),
                        strip: (line, field_block_end(source, *prop_end)),
                        comment: (line, cend + usize::from(source[cend..].starts_with('\n'))),
                    });
                }
                "state" => {
                    if *value_is_fn {
                        binding_issues.push(BindingIssue {
                            directive: "state".to_string(),
                            member: name.clone(),
                            class: classes[*class_idx].name.clone(),
                            problem: BindingProblem::StateOnFunction,
                            start: *name_start,
                            end: *name_end,
                        });
                    } else {
                        states.push(field_state_edit(
                            source,
                            name,
                            *name_start,
                            *name_end,
                            *type_span,
                            *value,
                        ));
                    }
                    strips.push((line, cend));
                }
                d @ ("effect" | "before-mount" | "mount" | "dispose") => {
                    if *value_is_fn {
                        match d {
                            "effect" => classes[*class_idx].effects.push(name.clone()),
                            "before-mount" => classes[*class_idx].before_mounts.push(name.clone()),
                            "mount" => classes[*class_idx].mounts.push(name.clone()),
                            "dispose" => classes[*class_idx].disposes.push(name.clone()),
                            _ => unreachable!(),
                        }
                    } else {
                        binding_issues.push(BindingIssue {
                            directive: d.to_string(),
                            member: name.clone(),
                            class: classes[*class_idx].name.clone(),
                            problem: BindingProblem::HookOnNonFunction,
                            start: *name_start,
                            end: *name_end,
                        });
                    }
                    strips.push((line, cend));
                }
                other => {
                    return Err(LocatedError {
                        err: field_error(other),
                        span: Some((*name_start, *name_end)),
                        component: Some(classes[*class_idx].name.clone()),
                    })
                }
            },
            Kind::Method {
                class_idx,
                name,
                name_start,
                name_end,
            } => match directive_name(&directives).map_err(|err| LocatedError {
                err,
                span: Some((*name_start, *name_end)),
                component: Some(classes[*class_idx].name.clone()),
            })? {
                "effect" => {
                    classes[*class_idx].effects.push(name.clone());
                    strips.push((line, cend));
                }
                "before-mount" => {
                    classes[*class_idx].before_mounts.push(name.clone());
                    strips.push((line, cend));
                }
                "mount" => {
                    classes[*class_idx].mounts.push(name.clone());
                    strips.push((line, cend));
                }
                "dispose" => {
                    classes[*class_idx].disposes.push(name.clone());
                    strips.push((line, cend));
                }
                "state" => {
                    binding_issues.push(BindingIssue {
                        directive: "state".to_string(),
                        member: name.clone(),
                        class: classes[*class_idx].name.clone(),
                        problem: BindingProblem::StateOnMethod,
                        start: *name_start,
                        end: *name_end,
                    });
                    strips.push((line, cend));
                }
                other => {
                    return Err(LocatedError {
                        err: field_error(other),
                        span: Some((*name_start, *name_end)),
                        component: Some(classes[*class_idx].name.clone()),
                    })
                }
            },
            Kind::Const {
                name_start,
                name_end,
                type_span,
                value,
            } => {
                let name = directive_name(&directives).map_err(|err| LocatedError {
                    err,
                    span: Some((*name_start, *name_end)),
                    component: None,
                })?;
                match name {
                    "state" => {
                        states.push(state_edit(source, *name_end, *type_span, *value));
                        strips.push((line, cend));
                    }
                    "store" => match directives[0].args.first() {
                        Some(store) => {
                            states.push(store_edit(source, *name_end, *type_span, *value, store));
                            strips.push((line, cend));
                        }
                        None => {
                            return Err(LocatedError {
                                err: LocateError::MissingName("store".to_string()),
                                span: Some((*name_start, *name_end)),
                                component: None,
                            })
                        }
                    },
                    other => {
                        return Err(LocatedError {
                            err: const_error(other),
                            span: Some((*name_start, *name_end)),
                            component: None,
                        })
                    }
                }
            }
        }
    }

    Ok(Located {
        classes,
        states,
        strips,
        binding_issues,
    })
}

fn key_name(key: &PropertyKey) -> String {
    match key {
        PropertyKey::StaticIdentifier(id) => id.name.to_string(),
        _ => String::new(),
    }
}

fn directive_name(directives: &[Directive]) -> Result<&str, LocateError> {
    match directives {
        [d] => Ok(d.name.as_str()),
        _ => Err(LocateError::OnField("(expected one directive)".to_string())),
    }
}

fn field_error(name: &str) -> LocateError {
    if is_known_directive(name) {
        LocateError::OnField(name.to_string())
    } else {
        LocateError::Unknown(name.to_string())
    }
}

fn const_error(name: &str) -> LocateError {
    if is_known_directive(name) {
        LocateError::OnConst(name.to_string())
    } else {
        LocateError::Unknown(name.to_string())
    }
}

fn state_edit(source: &str, name_end: usize, type_span: Option<Span>, value: Span) -> StateEdit {
    let init = slice(source, value);
    let generic = type_span.map_or(String::new(), |t| format!("<{}>", slice(source, t)));
    let trimmed = init.trim_start();
    let module_primitive = !(trimmed.starts_with('{') || trimmed.starts_with('['));
    StateEdit {
        start: name_end,
        end: value.end as usize,
        repl: format!(" = $__state{generic}({init})"),
        accessor: false,
        module_primitive,
        module: true,
        store_name: None,
    }
}

fn store_edit(
    source: &str,
    name_end: usize,
    type_span: Option<Span>,
    value: Span,
    name: &str,
) -> StateEdit {
    let init = slice(source, value);
    let generic = type_span.map_or(String::new(), |t| format!("<{}>", slice(source, t)));
    let trimmed = init.trim_start();
    let module_primitive = !(trimmed.starts_with('{') || trimmed.starts_with('['));
    StateEdit {
        start: name_end,
        end: value.end as usize,
        repl: format!(" = $__store{generic}('{name}', () => ({init}))"),
        accessor: false,
        module_primitive,
        module: true,
        store_name: Some(name.to_string()),
    }
}

fn field_state_edit(
    source: &str,
    name: &str,
    name_start: usize,
    name_end: usize,
    type_span: Option<Span>,
    value: Span,
) -> StateEdit {
    let init = slice(source, value);
    let generic = type_span.map_or(String::new(), |t| format!("<{}>", slice(source, t)));

    let trimmed = init.trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return StateEdit {
            start: name_end,
            end: value.end as usize,
            repl: format!(" = $__state{generic}({init})"),
            accessor: false,
            module_primitive: false,
            module: false,
            store_name: None,
        };
    }

    let bytes = source.as_bytes();
    let mut end = value.end as usize;
    let mut j = end;
    while j < bytes.len() && matches!(bytes[j], b' ' | b'\t') {
        j += 1;
    }
    if j < bytes.len() && bytes[j] == b';' {
        end = j + 1;
    }

    let ann = type_span.map_or(String::new(), |t| format!(": {}", slice(source, t)));
    let repl = format!(
        "#__{name}{ann} = $__state{generic}({init});\n    \
         #__{name}_dep = $__dep();\n    \
         get {name}(){ann} {{\n        \
         $__track(this.#__{name}_dep);\n        \
         return this.#__{name};\n    }}\n    \
         set {name}(value{ann}) {{\n        \
         const next = $__state{generic}(value);\n        \
         if (this.#__{name} === next) return;\n        \
         this.#__{name} = next;\n        \
         $__trigger(this.#__{name}_dep);\n    }}"
    );
    StateEdit {
        start: name_start,
        end,
        repl,
        accessor: true,
        module_primitive: false,
        module: false,
        store_name: None,
    }
}

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
            name_start: id.span.start as usize,
            name_end: id.span.end as usize,
            type_span: first
                .type_annotation
                .as_ref()
                .map(|t| t.type_annotation.span()),
            value,
        },
    ))
}

fn immediately_next_line(source: &str, from: usize, to: usize) -> bool {
    let gap = &source[from..to];
    gap.chars().all(char::is_whitespace) && gap.matches('\n').count() == 1
}

fn line_start(source: &str, at: usize) -> usize {
    source[..at].rfind('\n').map_or(0, |i| i + 1)
}

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
