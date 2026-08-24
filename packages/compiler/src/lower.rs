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
            let end = skip_to_close(body, i + 2, '}');
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

pub fn split_call_args(src: &str) -> Vec<String> {
    let c: Vec<char> = src.chars().collect();
    let Some(open) = c.iter().position(|&x| x == '(') else {
        return Vec::new();
    };
    let end = skip_to_close(&c, open + 1, ')');
    split_commas(&take(&c, open + 1, end - 1))
}

pub fn split_commas(src: &str) -> Vec<String> {
    let c: Vec<char> = src.chars().collect();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < c.len() {
        if let Some(ni) = skip_span(&c, i) {
            i = ni;
            continue;
        }
        if c[i] == ',' {
            parts.push(take(&c, start, i).trim().to_string());
            start = i + 1;
        }
        i += 1;
    }
    parts.push(take(&c, start, c.len()).trim().to_string());
    parts.retain(|p| !p.is_empty());
    parts
}

pub fn split_object_entries(src: &str) -> Vec<(String, String)> {
    let t = src.trim();
    let inner = t
        .strip_prefix('{')
        .and_then(|x| x.strip_suffix('}'))
        .unwrap_or(t);
    split_commas(inner)
        .into_iter()
        .filter_map(|e| split_at_top_colon(&e))
        .collect()
}

fn split_at_top_colon(entry: &str) -> Option<(String, String)> {
    let c: Vec<char> = entry.chars().collect();
    let mut i = 0;
    while i < c.len() {
        if let Some(ni) = skip_span(&c, i) {
            i = ni;
            continue;
        }
        if c[i] == ':' {
            let key: String = c[..i].iter().collect();
            let val: String = c[i + 1..].iter().collect();
            return Some((key.trim().to_string(), val.trim().to_string()));
        }
        i += 1;
    }
    None
}

pub fn split_ternary(src: &str) -> Option<(String, String, String)> {
    let c: Vec<char> = src.chars().collect();

    let q = find_ternary_question(&c, 0)?;

    let mut depth = 0;
    let mut j = q + 1;
    let colon = loop {
        if j >= c.len() {
            return None;
        }
        if let Some(nj) = skip_span(&c, j) {
            j = nj;
            continue;
        }
        match c[j] {
            '?' => {
                if matches!(c.get(j + 1), Some('?' | '.')) {
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

fn find_ternary_question(c: &[char], from: usize) -> Option<usize> {
    let mut i = from;
    while i < c.len() {
        if let Some(ni) = skip_span(c, i) {
            i = ni;
            continue;
        }
        match c[i] {
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

pub fn find_html_spans(src: &str) -> Vec<(usize, usize)> {
    let c: Vec<char> = src.chars().collect();
    let mut spans = Vec::new();
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '\'' | '"' => i = skip_string(&c, i, c[i]),
            '`' => i = tl_end(&c, i) + 1,
            _ if is_tpl_tag(&c, i) => {
                let end = tl_end(&c, i + 3);
                spans.push((i, end + 1));
                i = end + 1;
            }
            _ => i += 1,
        }
    }
    spans
}

pub fn slice(src: &str, start: usize, end: usize) -> String {
    src.chars().skip(start).take(end - start).collect()
}

fn is_tpl_tag(c: &[char], i: usize) -> bool {
    if i + 3 >= c.len() || c[i + 3] != '`' {
        return false;
    }
    if c[i..i + 3] != ['t', 'p', 'l'] {
        return false;
    }
    i == 0 || !is_ident_char(c[i - 1])
}

pub(crate) fn is_ident_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '$'
}

pub(crate) fn tl_end(c: &[char], open: usize) -> usize {
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

pub(crate) fn skip_to_close(c: &[char], from: usize, close: char) -> usize {
    let mut i = from;
    while i < c.len() {
        if c[i] == close {
            return i + 1;
        }
        if let Some(ni) = skip_span(c, i) {
            i = ni;
            continue;
        }
        i += 1;
    }
    i
}

fn skip_span(c: &[char], i: usize) -> Option<usize> {
    match c[i] {
        '\'' | '"' => Some(skip_string(c, i, c[i])),
        '`' => Some(tl_end(c, i) + 1),
        '(' => Some(skip_to_close(c, i + 1, ')')),
        '[' => Some(skip_to_close(c, i + 1, ']')),
        '{' => Some(skip_to_close(c, i + 1, '}')),
        _ => None,
    }
}

pub(crate) fn skip_string(c: &[char], i: usize, quote: char) -> usize {
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

pub(crate) fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}

pub(crate) fn apply_edits(source: &str, mut edits: Vec<(usize, usize, String)>) -> String {
    edits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}
