use crate::diagnostics::Diagnostic;
use crate::pragma::locate::{locate, BindingProblem};
use crate::pragma::lower::ExpandError;
use crate::pragma::{kebab, resolve, tag_problem};

pub const MODULE_STATE_PRIMITIVE_MSG: &str =
    "module-level `#state` must be an object - a bare primitive export can't be \
     reactive. Wrap it in a store object, e.g. `export const store = { count: 0 };` \
     and read `store.count`. (Bare primitives are reactive only as component class fields.)";

pub fn binding_issue_message(directive: &str, member: &str, problem: BindingProblem) -> String {
    match problem {
        BindingProblem::HookOnNonFunction => format!(
            "`#{directive}` must tag a method or an arrow function - `{member}` is a \
             data field, not a function. Move the logic into a method (or \
             `{member} = () => {{ ... }}`) and tag that"
        ),
        BindingProblem::StateOnFunction => format!(
            "`#{directive}` must tag a data field, not a function - `{member}` is a \
             function (state is reactive data, not behaviour)"
        ),
        BindingProblem::StateOnMethod => format!(
            "`#{directive}` must tag a data field, not a method - `{member}` (state \
             is reactive data, not behaviour)"
        ),
    }
}

pub fn invalid_tag_message(tag: &str, reason: &str, derived: bool) -> String {
    if derived {
        format!(
            "the class name derives the tag `{tag}`, which {reason} - give the \
             component an explicit `#tag`, or rename the class"
        )
    } else {
        format!("tag `{tag}` is not a valid custom element name - it {reason}")
    }
}

pub fn collect(source: &str) -> Vec<Diagnostic> {
    let mut out = Vec::new();

    let located = match locate(source) {
        Ok(l) => l,
        Err(e) => {
            out.push(Diagnostic::error(
                e.component.clone(),
                ExpandError::Locate(e.err).to_string(),
            ));
            return out;
        }
    };

    for b in &located.binding_issues {
        out.push(Diagnostic::error(
            Some(b.class.clone()),
            binding_issue_message(&b.directive, &b.member, b.problem),
        ));
    }

    for st in &located.states {
        if st.module_primitive {
            out.push(Diagnostic::error(
                None,
                MODULE_STATE_PRIMITIVE_MSG.to_string(),
            ));
        }
    }

    for class in &located.classes {
        if class.directives.is_empty() {
            continue;
        }
        match resolve(&class.directives) {
            Ok(meta) => {
                if meta.register {
                    let explicit = meta.tag.is_some();
                    let tag = meta.tag.unwrap_or_else(|| kebab(&class.name));
                    if let Some(reason) = tag_problem(&tag) {
                        out.push(Diagnostic::warning(
                            Some(class.name.clone()),
                            invalid_tag_message(&tag, &reason, !explicit),
                        ));
                    }
                }
            }
            Err(e) => out.push(Diagnostic::error(
                Some(class.name.clone()),
                ExpandError::Resolve(e).to_string(),
            )),
        }
    }

    out
}
