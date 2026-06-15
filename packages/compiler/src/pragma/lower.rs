//! Stage: lower pragma blocks into runtime wiring.
//!
//! For each block: hoist a `const _sN = sheet(<expr>)` per `#styles` (deduped by
//! expression, like the template hoister), append `<Class>.__sheets = [...]` and
//! `defineComponent('<tag>', <Class>)` after the class, strip the pragma
//! statements, and prepend the `@neuralfog/elemix/runtime` import for whatever
//! was used. Tag is the explicit `#tag` or `kebab(class_name)`.

use crate::pragma::locate::{locate, LocateError};
use crate::pragma::{kebab, resolve, Arg, PragmaError};
use std::collections::HashMap;

#[derive(Debug, PartialEq)]
pub enum ExpandError {
    Locate(LocateError),
    Resolve(PragmaError),
}

impl std::fmt::Display for ExpandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExpandError::Locate(LocateError::Orphan) => {
                write!(f, "pragma block has no component class directly below it")
            }
            ExpandError::Resolve(PragmaError::Unknown(n)) => {
                write!(f, "unknown pragma directive `#{n}`")
            }
            ExpandError::Resolve(PragmaError::DuplicateTag(a, b)) => {
                write!(f, "conflicting #tag values `{a}` and `{b}`")
            }
            ExpandError::Resolve(PragmaError::TagArity) => {
                write!(f, "#tag needs exactly one bare-word name")
            }
        }
    }
}

/// Expand every pragma block in `source`. Identity when there are none.
pub fn expand(source: &str) -> Result<String, ExpandError> {
    let blocks = locate(source).map_err(ExpandError::Locate)?;
    if blocks.is_empty() {
        return Ok(source.to_string());
    }

    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut counter = 0usize;
    let mut needs_sheet = false;
    let mut needs_define = false;

    for b in &blocks {
        let meta = resolve(&b.directives).map_err(ExpandError::Resolve)?;

        // #styles → hoisted sheet consts (deduped) + the class's __sheets.
        let mut hoist = String::new();
        let mut sheet_vars: Vec<String> = Vec::new();
        for arg in &meta.styles {
            let Arg::Expr(expr) = arg else { continue };
            let var = match seen.get(expr) {
                Some(v) => v.clone(),
                None => {
                    let v = format!("_s{counter}");
                    counter += 1;
                    needs_sheet = true;
                    hoist.push_str(&format!("const {v} = sheet({expr});\n"));
                    seen.insert(expr.clone(), v.clone());
                    v
                }
            };
            sheet_vars.push(var);
        }

        // New sheet consts go directly above this class (so the `css` import
        // they reference is already in scope, and later classes can reuse them).
        if !hoist.is_empty() {
            edits.push((b.class_start, b.class_start, hoist));
        }

        // #form → make the element form-associated. `formAssociated` must be a
        // static on the class (the browser reads it at registration); the base
        // `attachFormInternals` then attaches `internals` on connect.
        if meta.form {
            edits.push((
                b.class_body_open,
                b.class_body_open,
                "\n    static formAssociated = true;".to_string(),
            ));
        }

        // Strip the pragma statements (+ their trailing newline).
        let strip_end = b.block_end + trailing_newline(source, b.block_end);
        edits.push((b.block_start, strip_end, String::new()));

        // Append __sheets + defineComponent after the class.
        let mut after = String::new();
        if !sheet_vars.is_empty() {
            let spread = sheet_vars
                .iter()
                .map(|v| format!("...{v}"))
                .collect::<Vec<_>>()
                .join(", ");
            after.push_str(&format!("\n{}.__sheets = [{spread}];", b.class_name));
        }
        if meta.register {
            needs_define = true;
            let tag = meta.tag.unwrap_or_else(|| kebab(&b.class_name));
            after.push_str(&format!("\ndefineComponent('{tag}', {});", b.class_name));
        }
        if !after.is_empty() {
            edits.push((b.class_end, b.class_end, after));
        }
    }

    let mut names = Vec::new();
    if needs_define {
        names.push("defineComponent");
    }
    if needs_sheet {
        names.push("sheet");
    }
    if !names.is_empty() {
        edits.push((
            0,
            0,
            format!(
                "import {{ {} }} from '@neuralfog/elemix/runtime';\n",
                names.join(", ")
            ),
        ));
    }

    // Apply back-to-front so earlier offsets stay valid.
    edits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    Ok(out)
}

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
