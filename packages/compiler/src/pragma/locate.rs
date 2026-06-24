//! Stage: locate `//` pragma comments and bind each to the declaration on the
//! next line.
//!
//! Walks `program.comments`, keeps the line comments whose content is a pragma
//! (`#…`), and binds each to the nearest following declaration that sits on the
//! *immediately* next line (no blank line between):
//! - on a class → `#component`/`#tag`/`#form`/`#no-shadow` directives;
//! - on a class **field** → `#styles` (the field value is the stylesheet,
//!   inlined into `sheet(...)` and the field stripped);
//! - on a class field **or** module `const` → `#state` (wrap the initializer in
//!   `state<T>(…)`, lifting the type annotation into the generic);
//! - on a class **method** (or arrow field) → `#effect` (register a reactive
//!   effect) and the lifecycle markers `#before-mount`/`#mount`/`#dispose`,
//!   which synthesize the `beforeMount`/`onMount`/`onDispose` hook the base
//!   already calls — many tagged methods fold into one hook, in source order.
//!
//! The values stay real, type-checked expressions on the declaration — never
//! text in the comment.

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

/// A `#styles`-tagged class field: its initializer text (the value passed to
/// `sheet`), the full range to strip (marker comment + field line, for the
/// normal shadow case), and the comment-only range (for `#no-shadow`, where the
/// styles are skipped but the field stays so its value remains referenced).
#[derive(Debug, PartialEq)]
pub struct StyleField {
    pub value: String,
    pub strip: (usize, usize),
    pub comment: (usize, usize),
}

/// A `#state` rewrite: replace `[start, end)` with `repl`. For an object/array
/// initializer (or a module const) this wraps the value in `state<T>(…)`. For a
/// bare primitive class field it instead emits a get/set accessor backed by a
/// per-instance `dep()` (`accessor = true`), so `this.foo` itself is reactive.
///
/// `module_primitive` flags a module-level `#state` const with a bare primitive
/// initializer — illegal, because a module export has no `this` to hang an
/// accessor on and can't be reactive single-file. `diagnose` turns it into an
/// error steering to an object store.
#[derive(Debug, PartialEq)]
pub struct StateEdit {
    pub start: usize,
    pub end: usize,
    pub repl: String,
    pub accessor: bool,
    pub module_primitive: bool,
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
    /// Class-level directives WITH source spans (for precise hint carets). Parallel
    /// to `directives` but kept separate so the transform path stays span-free.
    pub directive_spans: Vec<SpannedDirective>,
    pub styles: Vec<StyleField>,
    pub effects: Vec<String>,
    /// `#before-mount`-tagged methods, in source order.
    pub before_mounts: Vec<String>,
    /// `#mount`-tagged methods, in source order.
    pub mounts: Vec<String>,
    /// `#dispose`-tagged methods, in source order.
    pub disposes: Vec<String>,
    /// The superclass identifier (`extends X`). `None`, or `Some("Component")`,
    /// means a base component; anything else is a component extending another
    /// component, so lifecycle hooks + `__sheets` must chain through `super`.
    pub super_class: Option<String>,
}

/// A directive tagging the wrong kind of member — what each can tag is fixed:
/// the lifecycle/effect hooks need a method or arrow field; `#state` needs a data
/// field (never a function or method). Non-fatal: the transform skips the binding
/// and `diagnose`/the analyzer report it (with a caret on the member).
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum BindingProblem {
    /// `#effect`/`#before-mount`/`#mount`/`#dispose` on a non-function field.
    HookOnNonFunction,
    /// `#state` on an arrow/function-valued field.
    StateOnFunction,
    /// `#state` on a method.
    StateOnMethod,
}

/// A member directive bound to the wrong target (see [`BindingProblem`]), with
/// the member-name span so a diagnostic can caret it.
#[derive(Debug, PartialEq)]
pub struct BindingIssue {
    pub directive: String,
    pub member: String,
    pub class: String,
    pub problem: BindingProblem,
    pub start: usize,
    pub end: usize,
}

/// Everything the lowering needs. `#state` declarations resolve `state` from
/// `@neuralfog/elemix/runtime` (a compile target), so no public-import surgery.
#[derive(Debug, PartialEq)]
pub struct Located {
    pub classes: Vec<ClassInfo>,
    pub states: Vec<StateEdit>,
    pub strips: Vec<(usize, usize)>,
    /// Member directives bound to the wrong target (see [`BindingIssue`]).
    pub binding_issues: Vec<BindingIssue>,
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
        name_start: usize,
        name_end: usize,
        type_span: Option<Span>,
        value: Span,
        prop_end: usize,
        /// Whether the field's value is a function (arrow or function expression)
        /// — the gate for the lifecycle/effect hooks.
        value_is_fn: bool,
    },
    Method {
        class_idx: usize,
        name: String,
        name_start: usize,
        name_end: usize,
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
            return Err(LocateError::Orphan);
        };
        if !immediately_next_line(source, cend, *start) {
            return Err(LocateError::Orphan);
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
            } => match directive_name(&directives)? {
                "styles" => classes[*class_idx].styles.push(StyleField {
                    value: slice(source, *value),
                    strip: (line, field_block_end(source, *prop_end)),
                    comment: (line, cend + usize::from(source[cend..].starts_with('\n'))),
                }),
                // `#state` tags reactive DATA — never a function. An arrow/function
                // field can't be wrapped in `state()` meaningfully; skip it and
                // record a precise issue.
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
                // Lifecycle/effect hooks: a field carries one only if its value is a
                // function (arrow); otherwise the runtime has nothing to call — skip
                // the binding and record a precise issue for diagnostics.
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
                other => return Err(LocateError::OnField(other.to_string())),
            },
            Kind::Method {
                class_idx,
                name,
                name_start,
                name_end,
            } => match directive_name(&directives)? {
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
                // `#state` tags reactive data, not behaviour — never a method.
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
        binding_issues,
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
/// A module const with a bare-primitive initializer is flagged `module_primitive`
/// for `diagnose` to reject — it would compile to a dead, non-reactive value.
fn state_edit(source: &str, name_end: usize, type_span: Option<Span>, value: Span) -> StateEdit {
    let init = slice(source, value);
    let generic = type_span.map_or(String::new(), |t| format!("<{}>", slice(source, t)));
    let trimmed = init.trim_start();
    let module_primitive = !(trimmed.starts_with('{') || trimmed.starts_with('['));
    StateEdit {
        start: name_end,
        end: value.end as usize,
        repl: format!(" = state{generic}({init})"),
        accessor: false,
        module_primitive,
    }
}

/// A `#state` class field. An object/array initializer keeps the cheap field
/// form (`= state<T>(…)`). A bare primitive (or any non-literal) initializer is
/// lowered to a get/set accessor over a private backing field + per-instance
/// `dep()`, making `this.<name>` itself reactive without a `.value` box.
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
            repl: format!(" = state{generic}({init})"),
            accessor: false,
            module_primitive: false,
        };
    }

    // Swallow the field's own trailing `;` so the generated accessor block
    // doesn't leave a stray empty statement after the `set` method.
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
        "#{name}{ann} = state{generic}({init});\n    \
         #{name}_dep = dep();\n    \
         get {name}(){ann} {{\n        \
         track(this.#{name}_dep);\n        \
         return this.#{name};\n    }}\n    \
         set {name}(value{ann}) {{\n        \
         const next = state{generic}(value);\n        \
         if (this.#{name} === next) return;\n        \
         this.#{name} = next;\n        \
         trigger(this.#{name}_dep);\n    }}"
    );
    StateEdit {
        start: name_start,
        end,
        repl,
        accessor: true,
        module_primitive: false,
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
