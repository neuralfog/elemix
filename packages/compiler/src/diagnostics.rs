#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub severity: Severity,
    pub component: Option<String>,
    pub message: String,
}

impl Diagnostic {
    pub fn error(component: Option<String>, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Error,
            component,
            message: message.into(),
        }
    }

    pub fn warning(component: Option<String>, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Warning,
            component,
            message: message.into(),
        }
    }

    pub fn render(&self) -> String {
        match &self.component {
            Some(c) => format!("[elemix] {c}: {}", self.message),
            None => format!("[elemix] {}", self.message),
        }
    }
}

pub fn has_errors(diags: &[Diagnostic]) -> bool {
    diags.iter().any(|d| d.severity == Severity::Error)
}

pub fn js_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\u{2028}' => out.push_str("\\u2028"),
            '\u{2029}' => out.push_str("\\u2029"),
            _ => out.push(c),
        }
    }
    out.push('\'');
    out
}

pub fn inline(output: &str, diags: &[Diagnostic]) -> String {
    if diags.is_empty() {
        return output.to_string();
    }
    let mut prelude = String::new();
    for d in diags.iter().filter(|d| d.severity == Severity::Warning) {
        prelude.push_str(&format!("console.warn({});\n", js_str(&d.render())));
    }
    for d in diags.iter().filter(|d| d.severity == Severity::Error) {
        prelude.push_str(&format!("throw new Error({});\n", js_str(&d.render())));
    }
    format!("{prelude}{output}")
}
