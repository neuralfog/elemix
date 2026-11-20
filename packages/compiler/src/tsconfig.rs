use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};

pub struct Aliases {
    base: PathBuf,
    patterns: Vec<Pattern>,
}

struct Pattern {
    prefix: String,
    suffix: Option<String>,
    targets: Vec<String>,
}

#[derive(Deserialize)]
struct RawTsconfig {
    #[serde(rename = "compilerOptions")]
    compiler_options: Option<CompilerOptions>,
}

#[derive(Deserialize)]
struct CompilerOptions {
    #[serde(rename = "baseUrl")]
    base_url: Option<String>,
    paths: Option<BTreeMap<String, Vec<String>>>,
}

impl Pattern {
    fn new(key: String, targets: Vec<String>) -> Self {
        match key.find('*') {
            Some(idx) => Self {
                prefix: key[..idx].to_string(),
                suffix: Some(key[idx + 1..].to_string()),
                targets,
            },
            None => Self {
                prefix: key,
                suffix: None,
                targets,
            },
        }
    }

    fn capture(&self, spec: &str) -> Option<Option<String>> {
        match &self.suffix {
            Some(suffix) => {
                if spec.len() >= self.prefix.len() + suffix.len()
                    && spec.starts_with(&self.prefix)
                    && spec.ends_with(suffix.as_str())
                {
                    let star = &spec[self.prefix.len()..spec.len() - suffix.len()];
                    Some(Some(star.to_string()))
                } else {
                    None
                }
            }
            None => (spec == self.prefix).then_some(None),
        }
    }
}

impl Aliases {
    pub fn resolve(&self, spec: &str) -> Vec<PathBuf> {
        let mut matches: Vec<(&Pattern, Option<String>)> = Vec::new();
        for pattern in &self.patterns {
            if let Some(star) = pattern.capture(spec) {
                matches.push((pattern, star));
            }
        }
        matches.sort_by(|a, b| {
            let a_exact = a.0.suffix.is_none();
            let b_exact = b.0.suffix.is_none();
            b_exact
                .cmp(&a_exact)
                .then(b.0.prefix.len().cmp(&a.0.prefix.len()))
        });
        let mut out = Vec::new();
        for (pattern, star) in matches {
            for target in &pattern.targets {
                let filled = match &star {
                    Some(s) => target.replacen('*', s, 1),
                    None => target.clone(),
                };
                out.push(normalize(&self.base.join(filled)));
            }
        }
        out
    }
}

pub fn load(start: &Path) -> Option<Aliases> {
    let config = find_tsconfig(start)?;
    let text = std::fs::read_to_string(&config).ok()?;
    parse(&text, config.parent()?)
}

pub fn find_tsconfig(start: &Path) -> Option<PathBuf> {
    for dir in start.ancestors() {
        let candidate = dir.join("tsconfig.json");
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

pub fn parse(text: &str, config_dir: &Path) -> Option<Aliases> {
    let cleaned = strip_trailing_commas(&strip_comments(text));
    let raw: RawTsconfig = serde_json::from_str(&cleaned).ok()?;
    let options = raw.compiler_options?;
    let paths = options.paths?;
    if paths.is_empty() {
        return None;
    }
    let base = match options.base_url {
        Some(url) => normalize(&config_dir.join(url)),
        None => config_dir.to_path_buf(),
    };
    let patterns = paths
        .into_iter()
        .map(|(key, targets)| Pattern::new(key, targets))
        .collect();
    Some(Aliases { base, patterns })
}

fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn strip_comments(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    let mut in_string = false;
    while i < chars.len() {
        let c = chars[i];
        if in_string {
            out.push(c);
            if c == '\\' && i + 1 < chars.len() {
                out.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == '"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }
        if c == '/' && i + 1 < chars.len() && chars[i + 1] == '/' {
            i += 2;
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }
        if c == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
            i += 2;
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i += 2;
            continue;
        }
        out.push(c);
        i += 1;
    }
    out
}

fn strip_trailing_commas(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    let mut in_string = false;
    while i < chars.len() {
        let c = chars[i];
        if in_string {
            out.push(c);
            if c == '\\' && i + 1 < chars.len() {
                out.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == '"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }
        if c == ',' {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_whitespace() {
                j += 1;
            }
            if j < chars.len() && (chars[j] == '}' || chars[j] == ']') {
                i += 1;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn aliases(text: &str) -> Aliases {
        parse(text, Path::new("/proj")).expect("parse succeeds")
    }

    #[test]
    fn resolves_wildcard_alias_relative_to_config_dir() {
        let a = aliases(r##"{"compilerOptions":{"paths":{"#views/*":["./Views/*"]}}}"##);
        assert_eq!(
            a.resolve("#views/Components/UI/ScrollHint.scss"),
            vec![PathBuf::from("/proj/Views/Components/UI/ScrollHint.scss")]
        );
    }

    #[test]
    fn base_url_shifts_the_resolution_root() {
        let a =
            aliases(r##"{"compilerOptions":{"baseUrl":"./src","paths":{"#app/*":["app/*"]}}}"##);
        assert_eq!(
            a.resolve("#app/theme.scss"),
            vec![PathBuf::from("/proj/src/app/theme.scss")]
        );
    }

    #[test]
    fn base_url_with_parent_segments_normalises() {
        let a =
            aliases(r##"{"compilerOptions":{"baseUrl":"../shared","paths":{"#c/*":["c/*"]}}}"##);
        assert_eq!(
            a.resolve("#c/x.scss"),
            vec![PathBuf::from("/shared/c/x.scss")]
        );
    }

    #[test]
    fn multiple_targets_are_tried_in_order() {
        let a = aliases(r##"{"compilerOptions":{"paths":{"#t/*":["./a/*","./b/*"]}}}"##);
        assert_eq!(
            a.resolve("#t/x.scss"),
            vec![
                PathBuf::from("/proj/a/x.scss"),
                PathBuf::from("/proj/b/x.scss"),
            ]
        );
    }

    #[test]
    fn longest_prefix_wins() {
        let a = aliases(
            r##"{"compilerOptions":{"paths":{"#x/*":["./broad/*"],"#x/deep/*":["./narrow/*"]}}}"##,
        );
        let got = a.resolve("#x/deep/y.scss");
        assert_eq!(got[0], PathBuf::from("/proj/narrow/y.scss"));
        assert_eq!(got[1], PathBuf::from("/proj/broad/deep/y.scss"));
    }

    #[test]
    fn exact_alias_beats_wildcard() {
        let a = aliases(
            r##"{"compilerOptions":{"paths":{"#one":["./exact.scss"],"#one/*":["./w/*"]}}}"##,
        );
        assert_eq!(a.resolve("#one"), vec![PathBuf::from("/proj/exact.scss")]);
    }

    #[test]
    fn suffix_wildcard_captures_the_middle() {
        let a = aliases(r##"{"compilerOptions":{"paths":{"#m/*/end":["./z/*/end"]}}}"##);
        assert_eq!(
            a.resolve("#m/mid/end"),
            vec![PathBuf::from("/proj/z/mid/end")]
        );
    }

    #[test]
    fn unmatched_specifier_yields_no_candidates() {
        let a = aliases(r##"{"compilerOptions":{"paths":{"#views/*":["./Views/*"]}}}"##);
        assert!(a.resolve("./relative.scss").is_empty());
        assert!(a.resolve("#other/x.scss").is_empty());
    }

    #[test]
    fn tolerates_comments_and_trailing_commas() {
        let text = r##"{
            // project config
            "compilerOptions": {
                /* alias map */
                "paths": {
                    "#views/*": ["./Views/*"],
                },
            },
        }"##;
        let a = aliases(text);
        assert_eq!(
            a.resolve("#views/x.scss"),
            vec![PathBuf::from("/proj/Views/x.scss")]
        );
    }

    #[test]
    fn comment_markers_inside_strings_are_preserved() {
        let text = r##"{"compilerOptions":{"paths":{"#p/*":["./a//b/*"]}}}"##;
        let a = aliases(text);
        assert_eq!(
            a.resolve("#p/x.scss"),
            vec![PathBuf::from("/proj/a/b/x.scss")]
        );
    }

    #[test]
    fn no_paths_is_none() {
        assert!(parse(
            r##"{"compilerOptions":{"strict":true}}"##,
            Path::new("/proj")
        )
        .is_none());
        assert!(parse(r##"{"compilerOptions":{"paths":{}}}"##, Path::new("/proj")).is_none());
    }

    #[test]
    fn garbage_is_none_not_a_panic() {
        assert!(parse("not json at all", Path::new("/proj")).is_none());
        assert!(parse("", Path::new("/proj")).is_none());
    }
}
