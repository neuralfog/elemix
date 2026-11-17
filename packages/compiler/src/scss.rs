use std::path::Path;

pub fn inline_scss_imports(source: &str, base_dir: Option<&Path>, minify: bool) -> String {
    let Some(dir) = base_dir else {
        return source.to_string();
    };
    let mut out = String::with_capacity(source.len());
    for line in source.split_inclusive('\n') {
        match try_inline(line, dir, minify) {
            Some(replacement) => out.push_str(&replacement),
            None => out.push_str(line),
        }
    }
    out
}

fn try_inline(line: &str, dir: &Path, minify: bool) -> Option<String> {
    let rest = line.trim_start().strip_prefix("import ")?.trim_start();
    let (ident, after) = read_ident(rest)?;
    let from = after.trim_start().strip_prefix("from ")?.trim_start();
    let spec = read_string(from)?;
    if !spec.contains(".scss") {
        return None;
    }
    let rel = spec.strip_suffix("?inline").unwrap_or(spec);
    let style = if minify {
        grass::OutputStyle::Compressed
    } else {
        grass::OutputStyle::Expanded
    };
    let css = grass::from_path(dir.join(rel), &grass::Options::default().style(style)).ok()?;
    let newline = if line.ends_with('\n') { "\n" } else { "" };
    Some(format!(
        "const {ident} = `{}`;{newline}",
        escape_template(&css)
    ))
}

fn read_ident(s: &str) -> Option<(&str, &str)> {
    let first = s.chars().next()?;
    if !(first == '_' || first == '$' || first.is_ascii_alphabetic()) {
        return None;
    }
    let end = s
        .find(|c: char| !(c == '_' || c == '$' || c.is_ascii_alphanumeric()))
        .unwrap_or(s.len());
    Some((&s[..end], &s[end..]))
}

fn read_string(s: &str) -> Option<&str> {
    let quote = s.chars().next()?;
    if quote != '\'' && quote != '"' {
        return None;
    }
    let rest = &s[1..];
    let end = rest.find(quote)?;
    Some(&rest[..end])
}

fn escape_template(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    for c in css.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '`' => out.push_str("\\`"),
            '$' => out.push_str("\\$"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURES: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures");

    #[test]
    fn inlines_scss_import_as_compiled_const() {
        let src = "import css from './ScssApp.scss?inline';\n";
        let out = inline_scss_imports(src, Some(Path::new(FIXTURES)), true);
        assert!(out.starts_with("const css = `"));
        assert!(out.contains(":host{"));
        assert!(!out.contains("import "));
        assert!(!out.contains(".scss"));
    }

    #[test]
    fn expanded_when_not_minified() {
        let src = "import css from './ScssApp.scss?inline';\n";
        let out = inline_scss_imports(src, Some(Path::new(FIXTURES)), false);
        assert!(out.contains(":host {"));
    }

    #[test]
    fn passthrough_without_base_dir() {
        let src = "import css from './x.scss?inline';\n";
        assert_eq!(inline_scss_imports(src, None, true), src);
    }

    #[test]
    fn leaves_non_scss_imports_untouched() {
        let src = "import { Component } from '@neuralfog/elemix';\n";
        assert_eq!(
            inline_scss_imports(src, Some(Path::new(FIXTURES)), true),
            src
        );
    }

    #[test]
    fn escapes_template_metacharacters() {
        assert_eq!(escape_template("a`b${c}\\d"), "a\\`b\\${c}\\\\d");
    }
}
