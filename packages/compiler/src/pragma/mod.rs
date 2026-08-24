pub mod diagnose;
pub mod locate;
pub mod lower;
pub mod parse;

pub use lower::{expand, expand_mode};

#[derive(Debug, Clone, PartialEq)]
pub struct Directive {
    pub name: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SpannedDirective {
    pub name: String,
    pub name_span: (usize, usize),
    pub args: Vec<(String, (usize, usize))>,
}

#[derive(Debug, Default, PartialEq)]
pub struct ComponentMeta {
    pub register: bool,
    pub tag: Option<String>,
    pub form: bool,
    pub no_shadow: bool,
    pub shadow: bool,
    pub client: bool,
    pub document: bool,
}

#[derive(Debug, PartialEq)]
pub enum PragmaError {
    Unknown(String),
    DuplicateTag(String, String),
    TagArity,
    OnClass(String),
    ShadowConflict,
}

pub fn is_known_directive(name: &str) -> bool {
    matches!(
        name,
        "component"
            | "tag"
            | "form"
            | "no-shadow"
            | "shadow"
            | "client"
            | "document"
            | "styles"
            | "state"
            | "store"
            | "effect"
            | "before-mount"
            | "mount"
            | "dispose"
    )
}

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
            "shadow" => meta.shadow = true,
            "client" => meta.client = true,
            "document" => {
                meta.document = true;
                meta.register = true;
                meta.no_shadow = true;
            }
            "styles" | "state" | "effect" | "before-mount" | "mount" | "dispose" => {
                return Err(PragmaError::OnClass(d.name.clone()))
            }
            other => return Err(PragmaError::Unknown(other.to_string())),
        }
    }
    if meta.shadow && meta.no_shadow {
        return Err(PragmaError::ShadowConflict);
    }
    Ok(meta)
}

fn single_word(d: &Directive) -> Option<String> {
    match d.args.as_slice() {
        [w] => Some(w.clone()),
        _ => None,
    }
}

pub fn kebab(class_name: &str) -> String {
    let chars: Vec<char> = class_name.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if c.is_uppercase() {
            let prev = if i > 0 { Some(chars[i - 1]) } else { None };
            let next = chars.get(i + 1).copied();
            let boundary = match (prev, next) {
                (Some(p), _) if p.is_lowercase() || p.is_ascii_digit() => true,
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

const RESERVED_TAGS: &[&str] = &[
    "annotation-xml",
    "color-profile",
    "font-face",
    "font-face-src",
    "font-face-uri",
    "font-face-format",
    "font-face-name",
    "missing-glyph",
];

pub fn tag_problem(tag: &str) -> Option<String> {
    if tag.is_empty() {
        return Some("is empty".to_string());
    }
    if RESERVED_TAGS.contains(&tag) {
        return Some("is a name reserved by SVG/MathML".to_string());
    }
    let first = tag.chars().next().unwrap();
    if !first.is_ascii_lowercase() {
        return Some("must start with a lowercase ASCII letter (a–z)".to_string());
    }
    if !tag.contains('-') {
        return Some("must contain a hyphen".to_string());
    }
    if tag.chars().any(|c| c.is_ascii_uppercase()) {
        return Some("must not contain uppercase letters".to_string());
    }
    if let Some(bad) = tag.chars().find(|&c| !is_tag_char(c)) {
        return Some(format!("contains an invalid character `{bad}`"));
    }
    None
}

fn is_tag_char(c: char) -> bool {
    if c.is_ascii() {
        matches!(c, 'a'..='z' | '0'..='9' | '-' | '.' | '_')
    } else {
        true
    }
}
