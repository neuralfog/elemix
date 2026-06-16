//! Stage: lower pragma-tagged declarations into runtime wiring.
//!
//! Strip every pragma comment, then: for each class apply `#component`/`#tag`/
//! `#form` + its `#styles` fields (inline the value into `sheet(...)`, strip the
//! field, wire `__sheets`); rewrite every `#state` declaration's initializer to
//! `state<T>(…)` and splice `state` into the `@neuralfog/elemix` import.

use crate::pragma::locate::{locate, LocateError};
use crate::pragma::{kebab, resolve, PragmaError};
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
                write!(f, "pragma comment has no declaration on the next line")
            }
            ExpandError::Locate(LocateError::OnConst(n)) => {
                write!(f, "`#{n}` can't tag a const; only #state may")
            }
            ExpandError::Locate(LocateError::OnField(n)) => {
                write!(f, "`#{n}` can't tag a field; only #styles/#state may")
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
            ExpandError::Resolve(PragmaError::OnClass(n)) => {
                write!(f, "`#{n}` must tag a declaration, not a class")
            }
        }
    }
}

/// Expand every pragma in `source`. Identity when there are none.
pub fn expand(source: &str) -> Result<String, ExpandError> {
    let located = locate(source).map_err(ExpandError::Locate)?;
    let no_pragmas = located.states.is_empty()
        && located
            .classes
            .iter()
            .all(|c| c.directives.is_empty() && c.styles.is_empty() && c.effects.is_empty());
    if no_pragmas {
        return Ok(source.to_string());
    }

    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut counter = 0usize;
    let mut needs_sheet = false;
    let mut needs_define = false;
    let mut needs_effect = false;

    // Strip every pragma comment (its whole line, incl. indentation + newline).
    for (s, e) in &located.strips {
        let end = e + trailing_newline(source, *e);
        edits.push((*s, end, String::new()));
    }

    // #state → wrap each initializer in `state<T>(…)`. `state` is a compile
    // target, imported from /runtime below (merged with the rest).
    for st in &located.states {
        edits.push((st.start, st.end, st.repl.clone()));
    }
    let needs_state = !located.states.is_empty();

    for class in &located.classes {
        if class.directives.is_empty() && class.styles.is_empty() && class.effects.is_empty() {
            continue;
        }
        let meta = resolve(&class.directives).map_err(ExpandError::Resolve)?;

        // #styles fields → strip each, hoist a `sheet(<value>)` (deduped) + __sheets.
        // Under #no-shadow there's no shadow root to adopt into, so skip the sheet
        // entirely — strip only the marker comment, leave the field (keeping its
        // value referenced) and emit nothing.
        let mut hoist = String::new();
        let mut sheet_vars: Vec<String> = Vec::new();
        for sf in &class.styles {
            if meta.no_shadow {
                edits.push((sf.comment.0, sf.comment.1, String::new()));
                continue;
            }
            edits.push((sf.strip.0, sf.strip.1, String::new()));
            let var = match seen.get(&sf.value) {
                Some(v) => v.clone(),
                None => {
                    let v = format!("_s{counter}");
                    counter += 1;
                    needs_sheet = true;
                    hoist.push_str(&format!("const {v} = sheet({});\n", sf.value));
                    seen.insert(sf.value.clone(), v.clone());
                    v
                }
            };
            sheet_vars.push(var);
        }
        if !hoist.is_empty() {
            edits.push((class.start, class.start, hoist));
        }

        // #form → static formAssociated inside the class body.
        if meta.form {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static formAssociated = true;".to_string(),
            ));
        }

        // #no-shadow → render to light DOM (the base skips attachShadow).
        if meta.no_shadow {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static __noShadow = true;".to_string(),
            ));
        }

        // #effect → a generated `effects()` hook the base runs (owned, disposed
        // separately from the view) registering one effect per tagged method.
        if !class.effects.is_empty() {
            needs_effect = true;
            let calls: String = class
                .effects
                .iter()
                .map(|name| format!("\n        effect(() => this.{name}());"))
                .collect();
            edits.push((
                class.body_open,
                class.body_open,
                format!("\n    effects(): void {{{calls}\n    }}"),
            ));
        }

        // __sheets + defineComponent after the class.
        let mut after = String::new();
        if !sheet_vars.is_empty() {
            let spread = sheet_vars
                .iter()
                .map(|v| format!("...{v}"))
                .collect::<Vec<_>>()
                .join(", ");
            after.push_str(&format!("\n{}.__sheets = [{spread}];", class.name));
        }
        if meta.register {
            needs_define = true;
            let tag = meta.tag.unwrap_or_else(|| kebab(&class.name));
            after.push_str(&format!("\ndefineComponent('{tag}', {});", class.name));
        }
        if !after.is_empty() {
            edits.push((class.end, class.end, after));
        }
    }

    let mut names = Vec::new();
    if needs_define {
        names.push("defineComponent");
    }
    if needs_sheet {
        names.push("sheet");
    }
    if needs_state {
        names.push("state");
    }
    if needs_effect {
        names.push("effect");
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

    // Apply back-to-front so earlier offsets stay valid; on a tie the wider
    // replace applies first.
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
