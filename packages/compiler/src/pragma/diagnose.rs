//! Collect diagnostics from a source's pragmas WITHOUT transforming it — the
//! analysis side of [`expand`]. Reuses [`locate`] + [`resolve`] so the messages
//! match the transform exactly, but never bails: every class is checked so all
//! problems surface in one pass, and each carries its component name for a
//! precise runtime message.

use crate::diagnostics::Diagnostic;
use crate::pragma::locate::{locate, BindingProblem};
use crate::pragma::lower::ExpandError;
use crate::pragma::{kebab, resolve, tag_problem};

/// The module-level `#state` primitive error — shared so the analyzer's spanned
/// scan reports the identical text (see `scan::scan_hints`).
pub const MODULE_STATE_PRIMITIVE_MSG: &str =
    "module-level `#state` must be an object — a bare primitive export can't be \
     reactive. Wrap it in a store object, e.g. `export const store = { count: 0 };` \
     and read `store.count`. (Bare primitives are reactive only as component class fields.)";

/// The message for a member directive bound to the wrong target, shared with the
/// analyzer's scan so both report identical text.
pub fn binding_issue_message(directive: &str, member: &str, problem: BindingProblem) -> String {
    match problem {
        BindingProblem::HookOnNonFunction => format!(
            "`#{directive}` must tag a method or an arrow function — `{member}` is \
             neither, so there is nothing to call"
        ),
        BindingProblem::StateOnFunction => format!(
            "`#{directive}` must tag a data field, not a function — `{member}` is a \
             function (state is reactive data, not behaviour)"
        ),
        BindingProblem::StateOnMethod => format!(
            "`#{directive}` must tag a data field, not a method — `{member}` (state \
             is reactive data, not behaviour)"
        ),
    }
}

/// The invalid-custom-element-tag message, shared with the analyzer's scan. The
/// severity is the caller's call (the analyzer treats it as an error); `reason`
/// is a [`tag_problem`] phrase reading after "it …".
///
/// `derived` tells the two cases apart: an explicit `#tag` is caret on the bad
/// value, so the message just names it. A DERIVED tag is caret on the CLASS NAME,
/// so the message must explain that the class name produced this tag and how to
/// fix it — otherwise "must contain a hyphen" pointing at `App` makes no sense.
pub fn invalid_tag_message(tag: &str, reason: &str, derived: bool) -> String {
    if derived {
        format!(
            "the class name derives the tag `{tag}`, which {reason} — give the \
             component an explicit `#tag`, or rename the class"
        )
    } else {
        format!("tag `{tag}` is not a valid custom element name — it {reason}")
    }
}

/// Every pragma error (per class) + warning (a registered tag that isn't a valid
/// custom-element name) in `source`. Empty when the pragmas are clean.
pub fn collect(source: &str) -> Vec<Diagnostic> {
    let mut out = Vec::new();

    let located = match locate(source) {
        Ok(l) => l,
        // A structural locate failure is file-level — no class to blame.
        Err(e) => {
            out.push(Diagnostic::error(None, ExpandError::Locate(e).to_string()));
            return out;
        }
    };

    // Member directives bound to the wrong target (hook on non-fn, state on fn/method).
    for b in &located.binding_issues {
        out.push(Diagnostic::error(
            Some(b.class.clone()),
            binding_issue_message(&b.directive, &b.member, b.problem),
        ));
    }

    // A module-level `#state` const can't be a bare primitive — there's no
    // `this` to make it reactive single-file. Steer to an object store.
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
