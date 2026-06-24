//! Generic pragma parsing — turn a `//` pragma comment's text into a
//! `Vec<Directive>`. A pragma is a line comment whose first non-whitespace
//! character is `#`. Directives split on `#`; each is `#name word…` with plain
//! word args. There is no interpolation — values live in the *declaration* the
//! pragma tags, never in the comment (the marker ≠ value rule), so this layer is
//! pure text and ignorant of what any directive means.

use super::{Directive, SpannedDirective};

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

/// Like [`split_directives`], but every name/arg token carries an ABSOLUTE source
/// span. `base` is the absolute offset of `content`'s first byte (the comment's
/// content start, i.e. just past `//`), so token offsets map to the real source.
pub fn split_directives_spanned(content: &str, base: usize) -> Vec<SpannedDirective> {
    let hashes: Vec<usize> = content.match_indices('#').map(|(i, _)| i).collect();
    let mut out = Vec::new();
    for (k, &hash) in hashes.iter().enumerate() {
        let seg_start = hash + 1; // just past this `#`
        let seg_end = hashes.get(k + 1).copied().unwrap_or(content.len());
        let mut tokens = whitespace_tokens(&content[seg_start..seg_end], base + seg_start);
        if tokens.is_empty() {
            continue;
        }
        let (name, name_span) = tokens.remove(0);
        out.push(SpannedDirective {
            name,
            name_span,
            args: tokens,
        });
    }
    out
}

/// Whitespace-delimited tokens of `seg`, each with an absolute span; `base` is
/// the absolute offset of `seg[0]`.
fn whitespace_tokens(seg: &str, base: usize) -> Vec<(String, (usize, usize))> {
    let mut out = Vec::new();
    let mut start: Option<usize> = None;
    for (i, c) in seg.char_indices() {
        if c.is_whitespace() {
            if let Some(s) = start.take() {
                out.push((seg[s..i].to_string(), (base + s, base + i)));
            }
        } else if start.is_none() {
            start = Some(i);
        }
    }
    if let Some(s) = start {
        out.push((seg[s..].to_string(), (base + s, base + seg.len())));
    }
    out
}
