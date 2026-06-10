//! String surgery for nested-template lowering.
//!
//! A nested `` tpl`...` `` is a verbatim substring of its hole's expression, so
//! lowering works on the expr string directly — no source spans needed. These
//! scanners do balanced matching over parens/brackets/braces, string literals,
//! and template literals (including `${...}` nesting), which is what makes
//! splitting directive args and finding nested templates robust.

/// Split a `` tpl`...` `` literal into its static strings + hole expressions —
/// the same `(statics, holes)` shape `locate` produces, but for a nested
/// template found inside an expression.
pub fn split_template_literal(src: &str) -> (Vec<String>, Vec<String>) {
    let c: Vec<char> = src.chars().collect();
    let Some(open) = c.iter().position(|&x| x == '`') else {
        return (vec![src.to_string()], vec![]);
    };
    let close = tl_end(&c, open);
    let body = &c[open + 1..close];

    let mut statics = Vec::new();
    let mut holes = Vec::new();
    let mut cur = String::new();
    let mut i = 0;
    while i < body.len() {
        if body[i] == '\\' {
            cur.push(body[i]);
            if i + 1 < body.len() {
                cur.push(body[i + 1]);
            }
            i += 2;
            continue;
        }
        if body[i] == '$' && i + 1 < body.len() && body[i + 1] == '{' {
            statics.push(std::mem::take(&mut cur));
            let end = skip_to_close(body, i + 2, '}'); // index after `}`
            holes.push(take(body, i + 2, end - 1).trim().to_string());
            i = end;
            continue;
        }
        cur.push(body[i]);
        i += 1;
    }
    statics.push(cur);
    (statics, holes)
}

/// Split a call expression `name(a, b, c)` into its top-level argument strings.
pub fn split_call_args(src: &str) -> Vec<String> {
    let c: Vec<char> = src.chars().collect();
    let Some(open) = c.iter().position(|&x| x == '(') else {
        return Vec::new();
    };
    let end = skip_to_close(&c, open + 1, ')'); // index after `)`
    split_commas(&take(&c, open + 1, end - 1))
}

/// Split a string by top-level commas, respecting nested brackets, strings, and
/// template literals. Empty pieces (from a trailing comma) are dropped.
pub fn split_commas(src: &str) -> Vec<String> {
    let c: Vec<char> = src.chars().collect();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '\'' | '"' => i = skip_string(&c, i, c[i]),
            '`' => i = tl_end(&c, i) + 1,
            '(' => i = skip_to_close(&c, i + 1, ')'),
            '[' => i = skip_to_close(&c, i + 1, ']'),
            '{' => i = skip_to_close(&c, i + 1, '}'),
            ',' => {
                parts.push(take(&c, start, i).trim().to_string());
                start = i + 1;
                i += 1;
            }
            _ => i += 1,
        }
    }
    parts.push(take(&c, start, c.len()).trim().to_string());
    parts.retain(|p| !p.is_empty());
    parts
}

/// Split a conditional expression `cond ? then : else` at its top-level `?`/`:`,
/// skipping optional-chaining `?.`, nullish `??`, and nested ternaries/brackets.
/// Returns `None` if `src` is not a ternary.
pub fn split_ternary(src: &str) -> Option<(String, String, String)> {
    let c: Vec<char> = src.chars().collect();

    let q = find_ternary_question(&c, 0)?;

    let mut depth = 0;
    let mut j = q + 1;
    let colon = loop {
        if j >= c.len() {
            return None;
        }
        match c[j] {
            '\'' | '"' => j = skip_string(&c, j, c[j]),
            '`' => j = tl_end(&c, j) + 1,
            '(' => j = skip_to_close(&c, j + 1, ')'),
            '[' => j = skip_to_close(&c, j + 1, ']'),
            '{' => j = skip_to_close(&c, j + 1, '}'),
            '?' => {
                if matches!(c.get(j + 1), Some('?') | Some('.')) {
                    j += if c.get(j + 1) == Some(&'?') { 2 } else { 1 };
                } else {
                    depth += 1;
                    j += 1;
                }
            }
            ':' if depth == 0 => break j,
            ':' => {
                depth -= 1;
                j += 1;
            }
            _ => j += 1,
        }
    };

    Some((
        take(&c, 0, q).trim().to_string(),
        take(&c, q + 1, colon).trim().to_string(),
        take(&c, colon + 1, c.len()).trim().to_string(),
    ))
}

/// Index of the first top-level ternary `?` (not `?.` / `??`).
fn find_ternary_question(c: &[char], from: usize) -> Option<usize> {
    let mut i = from;
    while i < c.len() {
        match c[i] {
            '\'' | '"' => i = skip_string(c, i, c[i]),
            '`' => i = tl_end(c, i) + 1,
            '(' => i = skip_to_close(c, i + 1, ')'),
            '[' => i = skip_to_close(c, i + 1, ']'),
            '{' => i = skip_to_close(c, i + 1, '}'),
            '?' => match c.get(i + 1) {
                Some('?') => i += 2,
                Some('.') => i += 1,
                _ => return Some(i),
            },
            _ => i += 1,
        }
    }
    None
}

/// Find every top-level `` tpl`...` `` in an expression, as char-index ranges.
/// Templates nested inside another template's `${...}` are skipped — they are
/// reached by recursing into that template's holes.
pub fn find_html_spans(src: &str) -> Vec<(usize, usize)> {
    let c: Vec<char> = src.chars().collect();
    let mut spans = Vec::new();
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '\'' | '"' => i = skip_string(&c, i, c[i]),
            '`' => i = tl_end(&c, i) + 1, // a bare template literal, not tpl-tagged
            _ if is_tpl_tag(&c, i) => {
                let end = tl_end(&c, i + 3); // backtick is at i+3
                spans.push((i, end + 1));
                i = end + 1;
            }
            _ => i += 1,
        }
    }
    spans
}

/// Slice a char range out of `src` as a `String`.
pub fn slice(src: &str, start: usize, end: usize) -> String {
    src.chars().skip(start).take(end - start).collect()
}

// --- balanced scanners --------------------------------------------------------

fn is_tpl_tag(c: &[char], i: usize) -> bool {
    if i + 3 >= c.len() || c[i + 3] != '`' {
        return false;
    }
    if c[i..i + 3] != ['t', 'p', 'l'] {
        return false;
    }
    i == 0 || !is_ident_char(c[i - 1])
}

fn is_ident_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '$'
}

/// `c[open]` is a backtick; return the index of the matching closing backtick.
fn tl_end(c: &[char], open: usize) -> usize {
    let mut i = open + 1;
    while i < c.len() {
        match c[i] {
            '\\' => i += 2,
            '`' => return i,
            '$' if i + 1 < c.len() && c[i + 1] == '{' => {
                i = skip_to_close(c, i + 2, '}');
            }
            _ => i += 1,
        }
    }
    i
}

/// `from` is just past an opener; return the index just past the matching
/// `close`, descending through nested brackets/strings/templates.
fn skip_to_close(c: &[char], from: usize, close: char) -> usize {
    let mut i = from;
    while i < c.len() {
        let ch = c[i];
        if ch == close {
            return i + 1;
        }
        match ch {
            '\'' | '"' => i = skip_string(c, i, ch),
            '`' => i = tl_end(c, i) + 1,
            '(' => i = skip_to_close(c, i + 1, ')'),
            '[' => i = skip_to_close(c, i + 1, ']'),
            '{' => i = skip_to_close(c, i + 1, '}'),
            _ => i += 1,
        }
    }
    i
}

/// `c[i]` is the opening quote; return the index just past the closing quote.
fn skip_string(c: &[char], i: usize, quote: char) -> usize {
    let mut j = i + 1;
    while j < c.len() {
        if c[j] == '\\' {
            j += 2;
            continue;
        }
        if c[j] == quote {
            return j + 1;
        }
        j += 1;
    }
    j
}

fn take(c: &[char], a: usize, b: usize) -> String {
    c[a..b].iter().collect()
}
