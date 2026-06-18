//! Compile diagnostics — collected during compilation and inlined into the
//! emitted module so a problem surfaces loudly instead of as a silent
//! mis-compile, and so the in-browser playground never goes dark (it compiles
//! per keystroke; a panic would blank the output). Errors become a module-scope
//! `throw`; warnings a `console.warn`. The native build can instead fail fast on
//! errors (see the CLI) so broken code never ships.

/// Error aborts the module (`throw`); Warning logs and keeps going
/// (`console.warn`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
}

/// One problem found at compile time, optionally attributed to a component
/// (its class name) so the runtime message names the culprit.
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

    /// The human-facing one-liner: `[elemix] <Component>: <message>` (the
    /// component segment is dropped when unknown).
    pub fn render(&self) -> String {
        match &self.component {
            Some(c) => format!("[elemix] {c}: {}", self.message),
            None => format!("[elemix] {}", self.message),
        }
    }
}

/// True when any diagnostic is an error.
pub fn has_errors(diags: &[Diagnostic]) -> bool {
    diags.iter().any(|d| d.severity == Severity::Error)
}

/// Escape a string into a single-quoted JS string literal (quotes included), so
/// a message with quotes/newlines/backslashes can't break the emitted module.
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

/// Inline diagnostics into the compiled module: warnings as `console.warn`
/// (logged first), then errors as `throw` (the first aborts evaluation). The
/// prelude is hoisted above the module — `import`s hoist past it, so they still
/// resolve before the throw runs. No diagnostics → output is returned untouched,
/// so the happy path is byte-identical.
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
