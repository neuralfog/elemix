//! Compile-time pragmas — `//` line comments that tag the declaration on the
//! next line, e.g.
//!
//! ```ignore
//! const css = `:host { display: grid; }`;
//!
//! // #component #tag pf-builder
//! class PfBuilder extends Component {
//!     // #styles
//!     styles = css;
//! }
//! ```
//!
//! A pragma MARKS; the real declaration CARRIES the value (so `tsc` checks it and
//! the same pragma works in `.ts` and `.js`). Generic parsing (a directive is a
//! `name` + word `args`) is decoupled from what a directive *means*: to add a
//! component-level directive you touch a field on [`ComponentMeta`] and one arm
//! in [`resolve`]; [`parse`] never changes.

pub mod diagnose;
pub mod locate;
pub mod lower;
pub mod parse;

pub use lower::expand;

/// A parsed directive — its `name` (without the leading `#`) and ordered word
/// args. Purely structural; the parser never knows what a directive means.
#[derive(Debug, Clone, PartialEq)]
pub struct Directive {
    pub name: String,
    pub args: Vec<String>,
}

/// The typed meaning of a component's pragma (the directives that tag the class
/// itself). `#styles` is NOT here — it tags a class field whose value is the
/// stylesheet (see [`locate`]/[`lower`]).
#[derive(Debug, Default, PartialEq)]
pub struct ComponentMeta {
    /// `#component` — register the class as a custom element.
    pub register: bool,
    /// `#tag <name>` — explicit tag; when absent the tag is derived from the
    /// class name via [`kebab`].
    pub tag: Option<String>,
    /// `#form` — make the element form-associated (inject the static
    /// `formAssociated = true` the browser reads at registration).
    pub form: bool,
    /// `#no-shadow` — render to light DOM (skip `attachShadow`); `#styles`
    /// adoption becomes a noop without a shadow root.
    pub no_shadow: bool,
}

#[derive(Debug, PartialEq)]
pub enum PragmaError {
    /// A directive name no handler claims — almost always a typo.
    Unknown(String),
    /// `#tag` given more than once with conflicting values.
    DuplicateTag(String, String),
    /// `#tag` without exactly one bare-word argument.
    TagArity,
    /// A declaration-level directive (`#styles`) found on a class pragma.
    OnClass(String),
}

/// Fold a class pragma's directives into typed meaning. **The extension point**
/// for component-level directives. `#styles` is rejected here — it belongs above
/// the `const` it tags, not on the class.
pub fn resolve(directives: &[Directive]) -> Result<ComponentMeta, PragmaError> {
    let mut meta = ComponentMeta::default();
    for d in directives {
        match d.name.as_str() {
            "component" => meta.register = true,
            "tag" => {
                let tag = single_word(d).ok_or(PragmaError::TagArity)?;
                if let Some(prev) = &meta.tag {
                    if *prev != tag {
                        return Err(PragmaError::DuplicateTag(prev.clone(), tag));
                    }
                }
                meta.tag = Some(tag);
            }
            "form" => meta.form = true,
            "no-shadow" => meta.no_shadow = true,
            "styles" | "state" | "effect" | "before-mount" | "mount" | "dispose" => {
                return Err(PragmaError::OnClass(d.name.clone()))
            }
            other => return Err(PragmaError::Unknown(other.to_string())),
        }
    }
    Ok(meta)
}

fn single_word(d: &Directive) -> Option<String> {
    match d.args.as_slice() {
        [w] => Some(w.clone()),
        _ => None,
    }
}

/// Derive a custom-element tag from a class name: PascalCase → kebab-case,
/// treating runs of capitals as acronyms (`PfXMLBuilder` → `pf-xml-builder`).
/// Validity (the required hyphen, reserved names) is intentionally NOT checked
/// here — `customElements.define` is the canonical validator and throws at
/// registration, so a hyphenless result like `Button` → `button` is emitted
/// verbatim and fails loudly at runtime.
pub fn kebab(class_name: &str) -> String {
    let chars: Vec<char> = class_name.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if c.is_uppercase() {
            let prev = if i > 0 { Some(chars[i - 1]) } else { None };
            let next = chars.get(i + 1).copied();
            let boundary = match (prev, next) {
                // lower/digit → Upper : end of a normal word (`fB`)
                (Some(p), _) if p.is_lowercase() || p.is_ascii_digit() => true,
                // Upper → Upper(lower) : end of an acronym (`L` in `XMLBuilder`)
                (Some(p), Some(n)) if p.is_uppercase() && n.is_lowercase() => true,
                _ => false,
            };
            if boundary && !out.is_empty() {
                out.push('-');
            }
            out.extend(c.to_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}
