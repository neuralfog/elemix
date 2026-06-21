//! Collect diagnostics from a source's pragmas WITHOUT transforming it — the
//! analysis side of [`expand`]. Reuses [`locate`] + [`resolve`] so the messages
//! match the transform exactly, but never bails: every class is checked so all
//! problems surface in one pass, and each carries its component name for a
//! precise runtime message.

use crate::diagnostics::Diagnostic;
use crate::pragma::locate::locate;
use crate::pragma::lower::ExpandError;
use crate::pragma::{kebab, resolve};

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

    // A module-level `#state` const can't be a bare primitive — there's no
    // `this` to make it reactive single-file. Steer to an object store.
    for st in &located.states {
        if st.module_primitive {
            out.push(Diagnostic::error(
                None,
                "module-level `#state` must be an object — a bare primitive \
                 export can't be reactive. Wrap it in a store object, e.g. \
                 `export const store = { count: 0 };` and read `store.count`. \
                 (Bare primitives are reactive only as component class fields.)"
                    .to_string(),
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
                    let tag = meta.tag.unwrap_or_else(|| kebab(&class.name));
                    if !tag.contains('-') {
                        out.push(Diagnostic::warning(
                            Some(class.name.clone()),
                            format!(
                                "tag `{tag}` is not a valid custom element name — \
                                 custom elements must contain a hyphen, so \
                                 `customElements.define` will throw at registration"
                            ),
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
