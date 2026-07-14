//! Project configuration: `elemix.toml` at (or above) the project root - the
//! single source of truth (the editors carry no formatter config, they only tell
//! `etf` where the root is). The formatter reads its `[formatter]` table; a
//! missing file, missing keys, or a malformed file all fall back to the built-in
//! defaults - so config never breaks formatting.
//!
//! ```toml
//! [formatter]
//! enabled = true          # false disables formatting + diagnostics entirely
//! indent_style = "space"  # "space" (default) or "tab"
//! indent_width = 4        # columns per indent level
//! line_width = 80         # max line width
//! ```
//!
//! Format-on-save is deliberately NOT here - it is an editor concern (a VS Code
//! setting / command, an nvim option), not project config.

use crate::doc::{IndentStyle, Options};
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// The resolved formatter settings: whether it runs at all, plus how it prints.
pub struct Settings {
    pub enabled: bool,
    pub options: Options,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            enabled: true,
            options: Options::default(),
        }
    }
}

#[derive(Deserialize, Default)]
struct ElemixConfig {
    formatter: Option<FormatterConfig>,
}

#[derive(Deserialize, Default)]
struct FormatterConfig {
    enabled: Option<bool>,
    indent_style: Option<String>,
    indent_width: Option<usize>,
    line_width: Option<usize>,
}

/// Load formatter `Settings` for a project rooted at `root`, from the nearest
/// `elemix.toml` at `root` or an ancestor. Defaults when absent/unparseable.
pub fn load(root: &str) -> Settings {
    let start = std::fs::canonicalize(root).unwrap_or_else(|_| PathBuf::from(root));
    let Some(text) = find(&start).and_then(|p| std::fs::read_to_string(p).ok()) else {
        return Settings::default();
    };
    from_toml(&text)
}

/// Parse `[formatter]` from an `elemix.toml` string into `Settings`, filling any
/// missing key from the defaults.
fn from_toml(text: &str) -> Settings {
    let cfg: ElemixConfig = toml::from_str(text).unwrap_or_default();
    let f = cfg.formatter.unwrap_or_default();
    let d = Options::default();
    Settings {
        enabled: f.enabled.unwrap_or(true),
        options: Options {
            width: f.line_width.unwrap_or(d.width),
            tab_width: f.indent_width.unwrap_or(d.tab_width),
            indent_style: match f.indent_style.as_deref() {
                Some("tab") => IndentStyle::Tab,
                _ => IndentStyle::Space,
            },
        },
    }
}

/// The nearest `elemix.toml` at `start` or an ancestor directory.
fn find(start: &Path) -> Option<PathBuf> {
    let mut dir = Some(start);
    while let Some(d) = dir {
        let candidate = d.join("elemix.toml");
        if candidate.is_file() {
            return Some(candidate);
        }
        dir = d.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_when_no_formatter_section() {
        let s = from_toml("[analyzer]\nfoo = 1\n");
        assert!(s.enabled);
        assert_eq!(s.options.width, 80);
        assert_eq!(s.options.tab_width, 4);
        assert_eq!(s.options.indent_style, IndentStyle::Space);
    }

    #[test]
    fn reads_the_formatter_section() {
        let s =
            from_toml("[formatter]\nindent_style = \"tab\"\nindent_width = 2\nline_width = 100\n");
        assert!(s.enabled);
        assert_eq!(s.options.width, 100);
        assert_eq!(s.options.tab_width, 2);
        assert_eq!(s.options.indent_style, IndentStyle::Tab);
    }

    #[test]
    fn enabled_false_disables_the_formatter() {
        assert!(!from_toml("[formatter]\nenabled = false\n").enabled);
        // Absent key defaults to enabled.
        assert!(from_toml("[formatter]\nindent_width = 2\n").enabled);
    }

    #[test]
    fn partial_config_keeps_other_defaults() {
        let s = from_toml("[formatter]\nline_width = 120\n");
        assert_eq!(s.options.width, 120);
        assert_eq!(s.options.tab_width, 4);
        assert_eq!(s.options.indent_style, IndentStyle::Space);
    }

    #[test]
    fn malformed_toml_falls_back_to_defaults() {
        let s = from_toml("this is not valid toml =====");
        assert!(s.enabled);
        assert_eq!(s.options.width, 80);
        assert_eq!(s.options.indent_style, IndentStyle::Space);
    }
}
