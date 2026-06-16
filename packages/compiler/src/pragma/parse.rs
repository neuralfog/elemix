//! Generic pragma parsing — turn a `//` pragma comment's text into a
//! `Vec<Directive>`. A pragma is a line comment whose first non-whitespace
//! character is `#`. Directives split on `#`; each is `#name word…` with plain
//! word args. There is no interpolation — values live in the *declaration* the
//! pragma tags, never in the comment (the marker ≠ value rule), so this layer is
//! pure text and ignorant of what any directive means.

use super::Directive;

/// Whether a line comment's content (the text after `//`) marks it a pragma —
/// the first non-whitespace character is `#`.
pub fn is_pragma(content: &str) -> bool {
    content.trim_start().starts_with('#')
}

/// Split a pragma comment's content into directives. `# foo a b # bar` →
/// `[{foo,[a,b]}, {bar,[]}]`. Empty/whitespace-only segments are skipped.
pub fn split_directives(content: &str) -> Vec<Directive> {
    content
        .split('#')
        .filter(|seg| !seg.trim().is_empty())
        .map(|seg| {
            let mut words = seg.split_whitespace();
            let name = words.next().unwrap_or_default().to_string();
            let args = words.map(str::to_string).collect();
            Directive { name, args }
        })
        .collect()
}
