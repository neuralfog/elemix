use std::path::Path;

pub fn compile_path(path: &Path, minify: bool) -> Option<String> {
    let style = if minify {
        grass::OutputStyle::Compressed
    } else {
        grass::OutputStyle::Expanded
    };
    let css = grass::from_path(path, &grass::Options::default().style(style)).ok()?;
    Some(if minify {
        crate::ssr_style::minify_css(&css)
    } else {
        css
    })
}

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
    let css = compile_path(&dir.join(rel), minify)?;
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
    const FEATURES: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/scss");

    fn feature_css(minify: bool) -> String {
        compile_path(&Path::new(FEATURES).join("features.scss"), minify)
            .expect("features.scss compiles")
    }

    #[test]
    fn mixin_and_module_variable_from_a_used_partial() {
        let css = feature_css(true);
        assert!(css.contains(".card{padding:16px;border-radius:8px"));
    }

    #[test]
    fn module_function_with_if_resolves() {
        assert!(feature_css(true).contains("color:#1e293b"));
    }

    #[test]
    fn each_over_a_map_with_interpolation() {
        let css = feature_css(true);
        assert!(css.contains(".text-a{color:#111}"));
        assert!(css.contains(".text-b{color:#222}"));
    }

    #[test]
    fn for_loop_with_math_and_parent_selector() {
        let css = feature_css(true);
        assert!(css.contains(".bar:nth-child(1){width:10px}"));
        assert!(css.contains(".bar:nth-child(3){width:30px}"));
    }

    #[test]
    fn expanded_keeps_full_hex_and_no_dynamic_source() {
        let css = feature_css(false);
        assert!(css.contains("#111111"));
        assert!(!css.contains("@use"));
        assert!(!css.contains("@mixin"));
    }

    #[test]
    fn inline_import_of_a_module_using_scss_file() {
        let src = "import css from './features.scss?inline';\n";
        let out = inline_scss_imports(src, Some(Path::new(FEATURES)), true);
        assert!(out.starts_with("const css = `"));
        assert!(out.contains(".card{padding:16px"));
        assert!(!out.contains("@include"));
    }

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
