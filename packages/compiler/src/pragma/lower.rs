use crate::lower::{apply_edits, trailing_newline};
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
                write!(f, "compiler hint has no declaration on the next line")
            }
            ExpandError::Locate(LocateError::OnConst(n)) => {
                write!(f, "`#{n}` can't tag a const; only #state/#store may")
            }
            ExpandError::Locate(LocateError::MissingName(n)) => {
                write!(f, "`#{n}` needs a name, e.g. `#store user-prefs`")
            }
            ExpandError::Locate(LocateError::OnField(n)) => {
                write!(f, "`#{n}` can't tag a field; only #styles/#state may")
            }
            ExpandError::Locate(LocateError::Unknown(n)) => {
                write!(f, "unknown compiler hint `#{n}`")
            }
            ExpandError::Resolve(PragmaError::Unknown(n)) => {
                write!(f, "unknown compiler hint `#{n}`")
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
            ExpandError::Resolve(PragmaError::ShadowConflict) => {
                write!(f, "`#shadow` and `#no-shadow` are mutually exclusive")
            }
        }
    }
}

pub fn expand(source: &str) -> Result<String, ExpandError> {
    expand_mode(source, false, false, false)
}

fn props_safe(body: &str) -> bool {
    let key = "this.props";
    let mut base = 0;
    while let Some(rel) = body[base..].find(key) {
        let pos = base + rel;
        base = pos + key.len();
        if pos > 0 {
            let prev = body[..pos].chars().next_back().unwrap();
            if prev.is_alphanumeric() || prev == '_' || prev == '$' || prev == '.' {
                continue;
            }
        }
        let rest = &body[base..];
        if !rest.starts_with('.') {
            return false;
        }
        let ident = &rest[1..];
        let end = ident
            .char_indices()
            .find(|(_, c)| !(c.is_alphanumeric() || *c == '_' || *c == '$'))
            .map_or(ident.len(), |(i, _)| i);
        if end == 0 {
            return false;
        }
        if let Some('.' | '(' | '[' | '?' | '`') = ident[end..].chars().next() {
            return false;
        }
    }
    true
}

pub fn expand_mode(
    source: &str,
    ssr: bool,
    hydrate: bool,
    minify: bool,
) -> Result<String, ExpandError> {
    let located = locate(source).map_err(|e| ExpandError::Locate(e.err))?;
    let no_pragmas = located.states.is_empty() && located.classes.iter().all(|c| !c.has_pragmas());
    if no_pragmas {
        return Ok(source.to_string());
    }

    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut counter = 0usize;
    let mut needs_sheet = false;
    let mut needs_define = false;
    let mut needs_effect = false;

    for (s, e) in &located.strips {
        let end = e + trailing_newline(source, *e);
        edits.push((*s, end, String::new()));
    }

    for st in &located.states {
        let repl = if st.module && st.store_name.is_none() && (ssr || hydrate) {
            wrap_module(&st.repl)
        } else {
            st.repl.clone()
        };
        edits.push((st.start, st.end, repl));
    }
    let needs_state = located
        .states
        .iter()
        .any(|st| st.store_name.is_none() && (!st.module || (!ssr && !hydrate)));
    let needs_module_state = hydrate
        && located
            .states
            .iter()
            .any(|st| st.store_name.is_none() && st.module);
    let needs_store = !ssr && located.states.iter().any(|st| st.store_name.is_some());
    let needs_reactive = located.states.iter().any(|st| st.accessor);

    for class in &located.classes {
        if !class.has_pragmas() {
            continue;
        }
        let meta = resolve(&class.directives).map_err(ExpandError::Resolve)?;

        let inherits = class
            .super_class
            .as_deref()
            .is_some_and(|s| s != "Component");

        let mut hoist = String::new();
        let mut sheet_vars: Vec<String> = Vec::new();
        for sf in &class.styles {
            if meta.no_shadow {
                edits.push((sf.comment.0, sf.comment.1, String::new()));
                continue;
            }
            edits.push((sf.strip.0, sf.strip.1, String::new()));
            if ssr {
                continue;
            }
            let var = match seen.get(&sf.value) {
                Some(v) => v.clone(),
                None => {
                    let v = format!("_s{counter}");
                    counter += 1;
                    needs_sheet = true;
                    let value = if minify {
                        crate::ssr_style::resolve_css(&sf.value, source).map_or_else(
                            || sf.value.clone(),
                            |css| {
                                format!(
                                    "`{}`",
                                    crate::template::parse::esc_tpl(&crate::ssr_style::minify_css(
                                        &css
                                    ),)
                                )
                            },
                        )
                    } else {
                        sf.value.clone()
                    };
                    hoist.push_str(&format!("const {v} = $__sheet({value});\n"));
                    seen.insert(sf.value.clone(), v.clone());
                    v
                }
            };
            sheet_vars.push(var);
        }
        if !hoist.is_empty() {
            edits.push((class.start, class.start, hoist));
        }

        if meta.form {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static formAssociated = true;".to_string(),
            ));
        }

        if meta.no_shadow {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static $$__noShadow = true;".to_string(),
            ));
        }

        if meta.shadow {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static $$__shadow = true;".to_string(),
            ));
        }

        if meta.client {
            edits.push((
                class.body_open,
                class.body_open,
                "\n    static $$__client = true;".to_string(),
            ));
        }

        if !ssr && !class.effects.is_empty() {
            needs_effect = true;
            let sup = if inherits {
                "\n        super.$$__effects?.();"
            } else {
                ""
            };
            let calls: String = class
                .effects
                .iter()
                .map(|name| format!("\n        $__effect(() => this.{name}());"))
                .collect();
            edits.push((
                class.body_open,
                class.body_open,
                format!("\n    $$__effects(): void {{{sup}{calls}\n    }}"),
            ));
        }

        for (hook, methods) in [
            ("$$__beforeMount", &class.before_mounts),
            ("$$__onMount", &class.mounts),
            ("$$__onDispose", &class.disposes),
        ] {
            if methods.is_empty() {
                continue;
            }
            if ssr && hook != "$$__beforeMount" {
                continue;
            }
            let calls: String = methods
                .iter()
                .map(|name| format!("\n        this.{name}();"))
                .collect();
            let body = if !inherits {
                calls
            } else if hook == "$$__onDispose" {
                format!("{calls}\n        super.{hook}?.();")
            } else {
                format!("\n        super.{hook}?.();{calls}")
            };
            edits.push((
                class.body_open,
                class.body_open,
                format!("\n    {hook}(): void {{{body}\n    }}"),
            ));
        }

        let mut after = String::new();
        if !sheet_vars.is_empty() {
            let spread = sheet_vars
                .iter()
                .map(|v| format!("...{v}"))
                .collect::<Vec<_>>()
                .join(", ");
            let name = &class.name;
            if inherits {
                after.push_str(&format!(
                    "\n{name}.$$__sheets = [...(Object.getPrototypeOf({name}).$$__sheets ?? []), {spread}];"
                ));
            } else {
                after.push_str(&format!("\n{name}.$$__sheets = [{spread}];"));
            }
        }
        if meta.register {
            needs_define = true;
            let tag = meta.tag.unwrap_or_else(|| kebab(&class.name));
            after.push_str(&format!("\n$__defineComponent('{tag}', {});", class.name));
            after.push_str(&format!("\n{}.prototype.$$__tag = '{tag}';", class.name));
            if ssr && !meta.client && props_safe(&source[class.body_open..class.end]) {
                after.push_str(&format!("\n{}.$$__propSafe = true;", class.name));
            }
        }
        if let Some(df) = &class.document_field {
            edits.push((df.strip.0, df.strip.1, String::new()));
            after.push_str(&format!("\n{}.$$__document = {};", class.name, df.value));
        }
        if !after.is_empty() {
            edits.push((class.end, class.end, after));
        }
    }

    let mut names = Vec::new();
    if needs_define {
        names.push("$__defineComponent");
    }
    if needs_sheet {
        names.push("$__sheet");
    }
    if needs_state {
        names.push("$__state");
    }
    if needs_store {
        names.push("$__store");
    }
    if needs_reactive {
        names.push("$__dep");
        names.push("$__track");
        names.push("$__trigger");
    }
    if needs_effect {
        names.push("$__effect");
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
    if needs_module_state {
        edits.push((
            0,
            0,
            "import { $__moduleState } from '@neuralfog/elemix/ssr-runtime/client';\n".to_string(),
        ));
    }

    Ok(apply_edits(source, edits))
}

fn wrap_module(repl: &str) -> String {
    let s = repl.replacen("$__state", "$__moduleState", 1);
    match (s.find('('), s.rfind(')')) {
        (Some(open), Some(close)) if open < close => {
            format!("{}(() => ({}))", &s[..open], &s[open + 1..close])
        }
        _ => s,
    }
}
