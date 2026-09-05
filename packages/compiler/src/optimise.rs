use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildMeta {
    pub tag: String,
    pub cls: String,
    pub prop_safe: bool,
    pub simple: bool,
    pub body: String,
}

fn to_chars(s: &str) -> Vec<char> {
    s.chars().collect()
}

fn from_chars(v: &[char]) -> String {
    v.iter().collect()
}

fn is_word(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

fn is_space(c: char) -> bool {
    c.is_ascii_whitespace()
}

fn eq_at(hay: &[char], at: usize, pat: &[char]) -> bool {
    at + pat.len() <= hay.len() && hay[at..at + pat.len()] == *pat
}

fn index_of(hay: &[char], needle: &[char], from: usize) -> Option<usize> {
    if needle.is_empty() {
        return Some(from.min(hay.len()));
    }
    if from >= hay.len() || needle.len() > hay.len() {
        return None;
    }
    let end = hay.len() - needle.len();
    (from..=end).find(|&i| hay[i..i + needle.len()] == *needle)
}

fn contains(hay: &[char], needle: &str) -> bool {
    index_of(hay, &to_chars(needle), 0).is_some()
}

fn trim(v: &[char]) -> Vec<char> {
    let mut a = 0;
    let mut b = v.len();
    while a < b && is_space(v[a]) {
        a += 1;
    }
    while b > a && is_space(v[b - 1]) {
        b -= 1;
    }
    v[a..b].to_vec()
}

#[derive(PartialEq, Clone, Copy)]
enum Mode {
    Code,
    Sq,
    Dq,
    Tmpl,
}

#[derive(PartialEq)]
enum Br {
    Open,
    Tmpl,
}

fn scan_balanced(s: &[char], start: usize) -> Option<usize> {
    let mut stack: Vec<Br> = Vec::new();
    let mut mode = Mode::Code;
    let mut i = start;
    while i < s.len() {
        let c = s[i];
        match mode {
            Mode::Sq => {
                if c == '\\' {
                    i += 1;
                } else if c == '\'' {
                    mode = Mode::Code;
                }
            }
            Mode::Dq => {
                if c == '\\' {
                    i += 1;
                } else if c == '"' {
                    mode = Mode::Code;
                }
            }
            Mode::Tmpl => {
                if c == '\\' {
                    i += 1;
                } else if c == '`' {
                    mode = Mode::Code;
                } else if c == '$' && i + 1 < s.len() && s[i + 1] == '{' {
                    stack.push(Br::Tmpl);
                    mode = Mode::Code;
                    i += 1;
                }
            }
            Mode::Code => {
                if c == '\'' {
                    mode = Mode::Sq;
                } else if c == '"' {
                    mode = Mode::Dq;
                } else if c == '`' {
                    mode = Mode::Tmpl;
                } else if c == '(' || c == '[' || c == '{' {
                    stack.push(Br::Open);
                } else if c == ')' || c == ']' || c == '}' {
                    let top = stack.pop();
                    if let Some(Br::Tmpl) = top {
                        mode = Mode::Tmpl;
                    } else if stack.is_empty() {
                        return Some(i);
                    }
                }
            }
        }
        i += 1;
    }
    None
}

fn ssr_body(src: &[char], cls: &str) -> Option<Vec<char>> {
    let cls_pat = to_chars(&format!("class {cls}"));
    let cls_at = index_of(src, &cls_pat, 0)?;
    let marker = index_of(src, &to_chars("$$__ssr()"), cls_at)?;
    let next = index_of(src, &to_chars("class "), cls_at + 6);
    if let Some(n) = next {
        if marker > n {
            return None;
        }
    }
    let ret = index_of(src, &to_chars("return"), marker)?;
    let open = index_of(src, &to_chars("["), ret)?;
    let close = scan_balanced(src, open)?;
    Some(src[open + 1..close].to_vec())
}

fn line_starts(src: &[char]) -> Vec<usize> {
    let mut out = vec![0usize];
    for (i, &c) in src.iter().enumerate() {
        if c == '\n' {
            out.push(i + 1);
        }
    }
    out
}

fn match_word(src: &[char], at: usize) -> Option<usize> {
    let mut i = at;
    while i < src.len() && is_word(src[i]) {
        i += 1;
    }
    if i > at {
        Some(i)
    } else {
        None
    }
}

fn skip_spaces(src: &[char], mut i: usize) -> usize {
    while i < src.len() && is_space(src[i]) {
        i += 1;
    }
    i
}

fn skip_spaces1(src: &[char], i: usize) -> Option<usize> {
    let j = skip_spaces(src, i);
    if j > i {
        Some(j)
    } else {
        None
    }
}

fn top_level_names(src: &[char], cls: &str) -> HashSet<String> {
    let mut names: HashSet<String> = HashSet::new();
    for &ls in &line_starts(src) {
        if eq_at(src, ls, &to_chars("import")) {
            if let Some(mut i) = skip_spaces1(src, ls + 6) {
                if i < src.len() && src[i] == '{' {
                    if let Some(close) = index_of(src, &to_chars("}"), i) {
                        for part in from_chars(&src[i + 1..close]).split(',') {
                            if let Some(n) = split_as_last(part) {
                                if !n.is_empty() {
                                    names.insert(n);
                                }
                            }
                        }
                    }
                } else if let Some(end) = match_word(src, i) {
                    names.insert(from_chars(&src[i..end]));
                } else if src[i] == '*' {
                    i += 1;
                    if let Some(j) = skip_spaces1(src, i) {
                        if eq_at(src, j, &to_chars("as")) {
                            if let Some(k) = skip_spaces1(src, j + 2) {
                                if let Some(end) = match_word(src, k) {
                                    names.insert(from_chars(&src[k..end]));
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some((_, name, _)) = match_decl_kw(src, ls, &["const", "let", "var"]) {
            names.insert(name);
        }

        if let Some((_, name, _)) = match_decl_kw(src, ls, &["function"]) {
            names.insert(name);
        }
    }
    names.remove(cls);
    names.remove("Component");
    names.retain(|n| !n.starts_with("$__"));
    names
}

fn split_as_last(part: &str) -> Option<String> {
    let t = part.trim();
    if t.is_empty() {
        return Some(String::new());
    }

    let chars: Vec<char> = t.chars().collect();
    let mut last_end = 0usize;
    let mut i = 0usize;
    while i < chars.len() {
        if is_space(chars[i]) {
            let ws_start = i;
            let mut j = i;
            while j < chars.len() && is_space(chars[j]) {
                j += 1;
            }
            if j + 2 <= chars.len() && chars[j] == 'a' && chars[j + 1] == 's' {
                let after = j + 2;
                if after < chars.len() && is_space(chars[after]) {
                    let mut k = after;
                    while k < chars.len() && is_space(chars[k]) {
                        k += 1;
                    }
                    last_end = k;
                    i = k;
                    continue;
                }
            }
            let _ = ws_start;
        }
        i += 1;
    }
    let seg: String = chars[last_end..].iter().collect();
    Some(seg.trim().to_string())
}

fn match_decl_kw(src: &[char], at: usize, kws: &[&str]) -> Option<(String, String, usize)> {
    let mut i = at;
    if eq_at(src, i, &to_chars("export")) {
        let j = skip_spaces1(src, i + 6)?;
        i = j;
    }
    for kw in kws {
        let kc = to_chars(kw);
        if eq_at(src, i, &kc) {
            let after = i + kc.len();
            if let Some(j) = skip_spaces1(src, after) {
                if let Some(end) = match_word(src, j) {
                    return Some((kw.to_string(), from_chars(&src[j..end]), end));
                }
            }
        }
    }
    None
}

fn inlinable_consts(src: &[char]) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    for &ls in &line_starts(src) {
        if let Some((name, raw, _end)) = match_const_lit(src, ls, true) {
            let content: Vec<char> = raw[1..raw.len() - 1].to_vec();
            if raw[0] == '`' {
                if contains(&content, "${") {
                    continue;
                }
                out.push((name, from_chars(&content)));
            } else {
                let unescaped = unescape_quotes(&content);
                let processed = escape_for_template(&unescaped);
                out.push((name, processed));
            }
        }
    }
    out
}

fn unescape_quotes(v: &[char]) -> Vec<char> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < v.len() {
        if v[i] == '\\' && i + 1 < v.len() && (v[i + 1] == '\'' || v[i + 1] == '"') {
            out.push(v[i + 1]);
            i += 2;
        } else {
            out.push(v[i]);
            i += 1;
        }
    }
    out
}

fn escape_for_template(v: &[char]) -> String {
    let mut s = String::new();
    for &c in v {
        if c == '\\' {
            s.push('\\');
            s.push('\\');
        } else {
            s.push(c);
        }
    }

    let s2 = s.replace('`', "\\`");

    s2.replace("${", "\\${")
}

fn foldable_consts(src: &[char]) -> HashMap<String, String> {
    let mut out: HashMap<String, String> = HashMap::new();
    for &ls in &line_starts(src) {
        if let Some((name, raw, _end)) = match_const_lit(src, ls, false) {
            let content: Vec<char> = raw[1..raw.len() - 1].to_vec();
            if raw[0] == '`' && contains(&content, "${") {
                continue;
            }
            out.insert(name, from_chars(&content));
        }
    }
    out
}

fn match_const_lit(src: &[char], at: usize, escapes: bool) -> Option<(String, Vec<char>, usize)> {
    let mut i = at;
    if eq_at(src, i, &to_chars("export")) {
        let j = skip_spaces1(src, i + 6)?;
        i = j;
    }
    if !eq_at(src, i, &to_chars("const")) {
        return None;
    }
    let j = skip_spaces1(src, i + 5)?;
    let name_end = match_word(src, j)?;
    let name = from_chars(&src[j..name_end]);
    let mut k = skip_spaces(src, name_end);
    if k >= src.len() || src[k] != '=' {
        return None;
    }
    k = skip_spaces(src, k + 1);
    if k >= src.len() {
        return None;
    }
    let q = src[k];
    let lit_end = match q {
        '\'' | '"' => scan_quote_lit(src, k, q, escapes)?,
        '`' => scan_backtick_lit(src, k, escapes)?,
        _ => return None,
    };

    let raw = src[k..lit_end + 1].to_vec();
    let mut m = skip_spaces(src, lit_end + 1);
    if m >= src.len() || src[m] != ';' {
        return None;
    }
    m += 1;
    Some((name, raw, m))
}

fn scan_quote_lit(src: &[char], at: usize, q: char, escapes: bool) -> Option<usize> {
    let mut i = at + 1;
    while i < src.len() {
        let c = src[i];
        if escapes {
            if c == '\\' {
                i += 2;
                continue;
            }
            if c == q {
                return Some(i);
            }
            i += 1;
        } else {
            if c == q {
                return Some(i);
            }
            if c == '\\' || c == '\n' {
                return None;
            }
            i += 1;
        }
    }
    None
}

fn scan_backtick_lit(src: &[char], at: usize, escapes: bool) -> Option<usize> {
    let mut i = at + 1;
    while i < src.len() {
        let c = src[i];
        if escapes {
            if c == '\\' {
                i += 2;
                continue;
            }
            if c == '`' {
                return Some(i);
            }
            i += 1;
        } else {
            if c == '`' {
                return Some(i);
            }
            if c == '\\' {
                return None;
            }
            i += 1;
        }
    }
    None
}

fn replace_all_str(s: &[char], from: &[char], to: &[char]) -> Vec<char> {
    if from.is_empty() {
        return s.to_vec();
    }
    let mut out = Vec::new();
    let mut i = 0;
    while i < s.len() {
        if i + from.len() <= s.len() && s[i..i + from.len()] == *from {
            out.extend_from_slice(to);
            i += from.len();
        } else {
            out.push(s[i]);
            i += 1;
        }
    }
    out
}

pub fn collect_meta(src_str: &str) -> Vec<ChildMeta> {
    let src = to_chars(src_str);
    let mut out: Vec<ChildMeta> = Vec::new();
    let forbidden = top_level_names(&src, "");
    let consts = inlinable_consts(&src);

    let mut pos = 0;
    let dc = to_chars("$__defineComponent('");
    while let Some(start) = index_of(&src, &dc, pos) {
        let tag_start = start + dc.len();

        let tag_close = match index_of(&src, &to_chars("'"), tag_start) {
            Some(t) if t > tag_start => t,
            _ => {
                pos = start + 1;
                continue;
            }
        };

        let mut i = tag_close + 1;
        if i >= src.len() || src[i] != ',' {
            pos = start + 1;
            continue;
        }
        i = skip_spaces(&src, i + 1);
        let cls_end = match match_word(&src, i) {
            Some(e) => e,
            None => {
                pos = start + 1;
                continue;
            }
        };
        if cls_end >= src.len() || src[cls_end] != ')' {
            pos = start + 1;
            continue;
        }
        let tag = from_chars(&src[tag_start..tag_close]);
        let cls = from_chars(&src[i..cls_end]);
        pos = cls_end + 1;

        let raw_body = match ssr_body(&src, &cls) {
            Some(b) => b,
            None => continue,
        };
        let mut body = raw_body;
        for (name, value) in &consts {
            let from = to_chars(&format!("${{{name}}}"));
            body = replace_all_str(&body, &from, &to_chars(value));
        }
        let prop_safe = test_prop_safe(&src, &cls);
        let cls_pat = to_chars(&format!("class {cls}"));
        let cls_at = index_of(&src, &cls_pat, 0);
        let brace = cls_at.and_then(|a| index_of(&src, &to_chars("{"), a));
        let brace_end = brace.and_then(|b| scan_balanced(&src, b));
        let region: Vec<char> = match (cls_at, brace_end) {
            (Some(a), Some(e)) => src[a..e].to_vec(),
            _ => src.clone(),
        };
        let class_simple = !class_uses_runtime(&region);
        let mut refs = forbidden.clone();
        refs.remove(&cls);
        let mut body_locals: HashSet<String> = HashSet::new();
        for (_, name) in scan_body_locals(&body) {
            body_locals.insert(name);
        }
        let uses_module_ref = refs
            .iter()
            .any(|n| !body_locals.contains(n) && has_bare_ref(&body, n));
        let uses_non_ssr_helper = has_non_ssr_helper(&body);
        let simple = class_simple && !uses_module_ref && !uses_non_ssr_helper;
        out.push(ChildMeta {
            tag,
            cls,
            prop_safe,
            simple,
            body: from_chars(&body),
        });
    }
    out
}

fn test_prop_safe(src: &[char], cls: &str) -> bool {
    let pat = to_chars(&format!("{cls}.$$__propSafe"));
    let mut pos = 0;
    while let Some(at) = index_of(src, &pat, pos) {
        let mut i = skip_spaces(src, at + pat.len());
        if i < src.len() && src[i] == '=' {
            i = skip_spaces(src, i + 1);
            if eq_at(src, i, &to_chars("true")) {
                return true;
            }
        }
        pos = at + 1;
    }
    false
}

fn class_uses_runtime(region: &[char]) -> bool {
    if contains(region, "$$__beforeMount") || contains(region, "$$__client") {
        return true;
    }

    let pat = to_chars("$__state");
    let mut pos = 0;
    while let Some(at) = index_of(region, &pat, pos) {
        let after = at + pat.len();
        if after >= region.len() || !is_word(region[after]) {
            return true;
        }
        pos = at + 1;
    }
    false
}

fn scan_body_locals(body: &[char]) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < body.len() {
        let kw = if eq_at(body, i, &to_chars("const")) {
            Some(5usize)
        } else if eq_at(body, i, &to_chars("let")) || eq_at(body, i, &to_chars("var")) {
            Some(3usize)
        } else {
            None
        };
        if let Some(kwlen) = kw {
            if let Some(j) = skip_spaces1(body, i + kwlen) {
                if let Some(end) = match_word(body, j) {
                    out.push((String::new(), from_chars(&body[j..end])));
                    i = end;
                    continue;
                }
            }
        }
        i += 1;
    }
    out
}

fn has_bare_ref(body: &[char], name: &str) -> bool {
    let pat = to_chars(name);
    if pat.is_empty() {
        return false;
    }
    let mut pos = 0;
    while let Some(at) = index_of(body, &pat, pos) {
        let before_ok = at == 0 || (!is_word(body[at - 1]) && body[at - 1] != '.');
        let after = at + pat.len();
        let after_ok = after >= body.len() || !is_word(body[after]);
        if before_ok && after_ok {
            return true;
        }
        pos = at + 1;
    }
    false
}

fn has_non_ssr_helper(body: &[char]) -> bool {
    let pat = to_chars("$__");
    let mut pos = 0;
    while let Some(at) = index_of(body, &pat, pos) {
        let before_ok = at == 0 || body[at - 1] != '$';
        let after = at + pat.len();
        let not_ssr = !eq_at(body, at + pat.len(), &to_chars("ssr"));
        let has_alpha =
            after < body.len() && (body[after].is_ascii_alphabetic() || body[after] == '_');
        if before_ok && not_ssr && has_alpha {
            return true;
        }
        pos = at + 1;
    }
    false
}

fn split_props(obj: &[char]) -> Vec<(String, String)> {
    let inner = &obj[1..obj.len() - 1];
    let mut out: Vec<(String, String)> = Vec::new();
    let mut i = 0usize;
    while i < inner.len() {
        while i < inner.len() && (is_space(inner[i]) || inner[i] == ',') {
            i += 1;
        }
        if i >= inner.len() {
            break;
        }
        let colon = match index_of(inner, &to_chars(":"), i) {
            Some(c) => c,
            None => break,
        };
        let key = from_chars(&trim(&inner[i..colon]));
        let mut j = colon + 1;
        while j < inner.len() && is_space(inner[j]) {
            j += 1;
        }
        let vstart = j;
        let mut depth = 0i32;
        let mut mode = Mode::Code;
        while j < inner.len() {
            let c = inner[j];
            match mode {
                Mode::Sq => {
                    if c == '\\' {
                        j += 1;
                    } else if c == '\'' {
                        mode = Mode::Code;
                    }
                }
                Mode::Dq => {
                    if c == '\\' {
                        j += 1;
                    } else if c == '"' {
                        mode = Mode::Code;
                    }
                }
                Mode::Tmpl => {
                    if c == '\\' {
                        j += 1;
                    } else if c == '`' {
                        mode = Mode::Code;
                    }
                }
                Mode::Code => {
                    if c == '\'' {
                        mode = Mode::Sq;
                    } else if c == '"' {
                        mode = Mode::Dq;
                    } else if c == '`' {
                        mode = Mode::Tmpl;
                    } else if c == '(' || c == '[' || c == '{' {
                        depth += 1;
                    } else if c == ')' || c == ']' || c == '}' {
                        depth -= 1;
                    } else if c == ',' && depth == 0 {
                        break;
                    }
                }
            }
            j += 1;
        }
        out.push((key, from_chars(&trim(&inner[vstart..j]))));
        i = j + 1;
    }
    out
}

fn top_level_args(s: &[char], open: usize, close: usize) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut start = open + 1;
    let mut stack: Vec<Br> = Vec::new();
    let mut mode = Mode::Code;
    let mut i = open + 1;
    while i < close {
        let c = s[i];
        match mode {
            Mode::Sq => {
                if c == '\\' {
                    i += 1;
                } else if c == '\'' {
                    mode = Mode::Code;
                }
            }
            Mode::Dq => {
                if c == '\\' {
                    i += 1;
                } else if c == '"' {
                    mode = Mode::Code;
                }
            }
            Mode::Tmpl => {
                if c == '\\' {
                    i += 1;
                } else if c == '`' {
                    mode = Mode::Code;
                } else if c == '$' && i + 1 < s.len() && s[i + 1] == '{' {
                    stack.push(Br::Tmpl);
                    mode = Mode::Code;
                    i += 1;
                }
            }
            Mode::Code => {
                if c == '\'' {
                    mode = Mode::Sq;
                } else if c == '"' {
                    mode = Mode::Dq;
                } else if c == '`' {
                    mode = Mode::Tmpl;
                } else if c == '(' || c == '[' || c == '{' {
                    stack.push(Br::Open);
                } else if c == ')' || c == ']' || c == '}' {
                    if let Some(Br::Tmpl) = stack.pop() {
                        mode = Mode::Tmpl;
                    }
                } else if c == ',' && stack.is_empty() {
                    args.push(from_chars(&trim(&s[start..i])));
                    start = i + 1;
                }
            }
        }
        i += 1;
    }
    args.push(from_chars(&trim(&s[start..close])));
    args
}

fn is_empty_arg(arg: Option<&str>) -> bool {
    match arg {
        None => true,
        Some(a) => {
            a == "undefined"
                || a == "null"
                || a == "''"
                || a == "\"\""
                || a == "``"
                || a == "[]"
                || a.trim().is_empty()
        }
    }
}

fn parse_slot_names(arg: Option<&str>) -> Option<Vec<String>> {
    let arg = arg?;
    let t = arg.trim();
    let tc: Vec<char> = t.chars().collect();
    if tc.len() < 2 || tc[0] != '[' || tc[tc.len() - 1] != ']' {
        return None;
    }
    let inner: String = tc[1..tc.len() - 1].iter().collect();
    if inner.contains(']') {
        return None;
    }
    let inner = inner.trim();
    if inner.is_empty() {
        return Some(vec![]);
    }
    let mut names = Vec::new();
    for part in inner.split(',') {
        let p = part.trim();
        let pc: Vec<char> = p.chars().collect();
        if pc.len() < 2 {
            return None;
        }
        let q = pc[0];
        if (q != '\'' && q != '"') || pc[pc.len() - 1] != q {
            return None;
        }
        let mid: String = pc[1..pc.len() - 1].iter().collect();
        if mid.contains('\'') || mid.contains('"') {
            return None;
        }
        names.push(mid);
    }
    Some(names)
}

fn starts_with_char(v: &[char], c: char) -> bool {
    !v.is_empty() && v[0] == c
}

fn ends_with_char(v: &[char], c: char) -> bool {
    !v.is_empty() && v[v.len() - 1] == c
}

fn ends_with(v: &[char], pat: &str) -> bool {
    let p = to_chars(pat);
    v.len() >= p.len() && v[v.len() - p.len()..] == p[..]
}

fn replace_prop(body: &[char], key: &str, to: &[char]) -> Vec<char> {
    let pat = to_chars(&format!("this.props.{key}"));
    let mut out = Vec::new();
    let mut i = 0;
    while i < body.len() {
        if eq_at(body, i, &pat) {
            let after = i + pat.len();
            let boundary = after >= body.len() || !is_word(body[after]);
            if boundary {
                out.extend_from_slice(to);
                i = after;
                continue;
            }
        }
        out.push(body[i]);
        i += 1;
    }
    out
}

fn erase_prop(body: &[char], key: &str) -> Vec<char> {
    replace_prop(body, key, &[])
}

fn has_bare_this_props(body: &[char]) -> bool {
    has_bare_word(body, "this.props")
}

fn has_bare_this_hasslot(body: &[char]) -> bool {
    has_bare_word(body, "this.hasSlot")
}

fn replace_has_slot(body: &[char], slot_names: &Option<Vec<String>>) -> Vec<char> {
    let pat = to_chars("this.hasSlot(");
    let mut out = Vec::new();
    let mut i = 0;
    while i < body.len() {
        if eq_at(body, i, &pat) {
            let mut j = skip_spaces(body, i + pat.len());
            if j < body.len() && (body[j] == '\'' || body[j] == '"') {
                let q = body[j];
                let name_start = j + 1;
                let mut k = name_start;
                while k < body.len() && body[k] != '\'' && body[k] != '"' {
                    k += 1;
                }

                if k < body.len() && body[k] == q {
                    let mut m = skip_spaces(body, k + 1);
                    if m < body.len() && body[m] == ')' {
                        let name: String = body[name_start..k].iter().collect();
                        let present = slot_names.as_ref().is_some_and(|v| v.contains(&name));
                        out.extend_from_slice(&to_chars(if present { "true" } else { "false" }));
                        i = m + 1;
                        let _ = &mut j;
                        let _ = &mut m;
                        continue;
                    }
                }
            }
        }
        out.push(body[i]);
        i += 1;
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn inline_child(
    child: &ChildMeta,
    props: &[(String, String)],
    raw_props: &str,
    slot: Option<&str>,
    attrs: Option<&str>,
    slot_names: &Option<Vec<String>>,
) -> Option<String> {
    let mut body = to_chars(&child.body);
    let tag = &child.tag;
    body = replace_all_str(
        &body,
        &to_chars(&format!("${{this.$$__tag ?? '{tag}'}}")),
        &to_chars(tag),
    );
    body = replace_all_str(
        &body,
        &to_chars(&format!("this.$$__tag ?? '{tag}'")),
        &to_chars(&format!("'{tag}'")),
    );
    body = replace_all_str(&body, &to_chars("${this.$$__tag}"), &to_chars(tag));
    body = replace_all_str(
        &body,
        &to_chars("this.$$__tag"),
        &to_chars(&format!("'{tag}'")),
    );
    body = replace_has_slot(&body, slot_names);

    let mut probe = body.clone();
    for (key, _) in props {
        probe = erase_prop(&probe, key);
    }
    if has_bare_this_props(&probe) || has_bare_this_hasslot(&probe) {
        return None;
    }

    let mut keys: Vec<&(String, String)> = props.iter().collect();
    keys.sort_by_key(|entry| std::cmp::Reverse(entry.0.chars().count()));
    for (key, val) in keys {
        body = replace_prop(&body, key, &to_chars(val));
    }

    let attr_part: Vec<char> = if is_empty_arg(attrs) {
        vec![]
    } else {
        to_chars(&format!("${{{}}}", attrs.unwrap()))
    };
    let data_part: Vec<char> = if child.prop_safe || raw_props.trim() == "{}" {
        vec![]
    } else {
        to_chars(&format!("${{$__ssrData({raw_props})}}"))
    };
    let mut inject = attr_part;
    inject.extend_from_slice(&data_part);
    let has_slot = !is_empty_arg(slot);

    let mut parts = top_level_args_from_zero(&body);

    if !inject.is_empty() {
        let first = to_chars(&parts[0]);
        if !starts_with_char(&first, '`') || !ends_with_char(&first, '`') {
            return None;
        }
        let open_pat = to_chars(&format!("<{tag}"));
        let at = index_of(&first, &open_pat, 0)?;
        let insert_at = at + open_pat.len();
        let mut new_first = first[..insert_at].to_vec();
        new_first.extend_from_slice(&inject);
        new_first.extend_from_slice(&first[insert_at..]);
        parts[0] = from_chars(&new_first);
    }

    if !has_slot {
        return Some(format!("[{}]", parts.join(", ")));
    }

    let close = format!("</{tag}>");
    let last_idx = parts.len() - 1;
    let last = to_chars(&parts[last_idx]);
    if !starts_with_char(&last, '`') || !ends_with_char(&last, '`') {
        return None;
    }
    let inner = &last[1..last.len() - 1];
    if !ends_with(inner, &close) {
        return None;
    }
    let trimmed = &inner[..inner.len() - to_chars(&close).len()];
    parts[last_idx] = format!("`{}`", from_chars(trimmed));
    Some(format!(
        "[{}, {}, `{}`]",
        parts.join(", "),
        slot.unwrap(),
        close
    ))
}

fn top_level_args_from_zero(s: &[char]) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut start = 0usize;
    let mut stack: Vec<Br> = Vec::new();
    let mut mode = Mode::Code;
    let mut i = 0usize;
    let close = s.len();
    while i < close {
        let c = s[i];
        match mode {
            Mode::Sq => {
                if c == '\\' {
                    i += 1;
                } else if c == '\'' {
                    mode = Mode::Code;
                }
            }
            Mode::Dq => {
                if c == '\\' {
                    i += 1;
                } else if c == '"' {
                    mode = Mode::Code;
                }
            }
            Mode::Tmpl => {
                if c == '\\' {
                    i += 1;
                } else if c == '`' {
                    mode = Mode::Code;
                } else if c == '$' && i + 1 < s.len() && s[i + 1] == '{' {
                    stack.push(Br::Tmpl);
                    mode = Mode::Code;
                    i += 1;
                }
            }
            Mode::Code => {
                if c == '\'' {
                    mode = Mode::Sq;
                } else if c == '"' {
                    mode = Mode::Dq;
                } else if c == '`' {
                    mode = Mode::Tmpl;
                } else if c == '(' || c == '[' || c == '{' {
                    stack.push(Br::Open);
                } else if c == ')' || c == ']' || c == '}' {
                    if let Some(Br::Tmpl) = stack.pop() {
                        mode = Mode::Tmpl;
                    }
                } else if c == ',' && stack.is_empty() {
                    args.push(from_chars(&trim(&s[start..i])));
                    start = i + 1;
                }
            }
        }
        i += 1;
    }
    args.push(from_chars(&trim(&s[start..close])));
    args
}

fn ensure_import(src: &[char], helper: &str) -> Vec<char> {
    if !has_helper_word(src, helper) {
        return src.to_vec();
    }
    let from_pat = to_chars("from '@neuralfog/elemix/ssr-runtime'");
    if index_of(src, &from_pat, 0).is_some() {
        let import_kw = to_chars("import {");
        let mut pos = 0;
        while let Some(imp) = index_of(src, &import_kw, pos) {
            let brace_open = imp + import_kw.len() - 1;
            if let Some(brace_close) = index_of(src, &to_chars("}"), brace_open) {
                let tail = to_chars(" from '@neuralfog/elemix/ssr-runtime'");
                if eq_at(src, brace_close + 1, &tail) {
                    let names_str = from_chars(&src[brace_open + 1..brace_close]);
                    let mut set: Vec<String> = Vec::new();
                    for n in names_str.split(',') {
                        let t = n.trim();
                        if !t.is_empty() && !set.iter().any(|x| x == t) {
                            set.push(t.to_string());
                        }
                    }
                    if set.iter().any(|x| x == helper) {
                        return src.to_vec();
                    }
                    set.push(helper.to_string());
                    let new_import = format!(
                        "import {{ {} }} from '@neuralfog/elemix/ssr-runtime'",
                        set.join(", ")
                    );
                    let mut out = src[..imp].to_vec();
                    out.extend_from_slice(&to_chars(&new_import));
                    out.extend_from_slice(&src[brace_close + 1 + tail.len()..]);
                    return out;
                }
            }
            pos = imp + 1;
        }
        return src.to_vec();
    }
    let mut out = to_chars(&format!(
        "import {{ {helper} }} from '@neuralfog/elemix/ssr-runtime';\n"
    ));
    out.extend_from_slice(src);
    out
}

fn has_helper_word(src: &[char], helper: &str) -> bool {
    let pat = to_chars(helper);
    let mut pos = 0;
    while let Some(at) = index_of(src, &pat, pos) {
        let after = at + pat.len();
        let boundary = after >= src.len() || !is_word(src[after]);
        if boundary {
            return true;
        }
        pos = at + 1;
    }
    false
}

fn literal_content(arg: &[char]) -> Option<String> {
    let t = trim(arg);
    if t.len() < 2 {
        return None;
    }
    let q = t[0];
    let end = t[t.len() - 1];
    if (q == '\'' || q == '"') && end == q {
        let inner = &t[1..t.len() - 1];
        if inner.contains(&'\\') || inner.contains(&q) || inner.contains(&'\n') {
            return None;
        }
        return Some(from_chars(inner));
    }
    if q == '`' && end == '`' {
        let inner = &t[1..t.len() - 1];
        if inner.contains(&'\\') || contains(inner, "${") {
            return None;
        }
        return Some(from_chars(inner));
    }
    None
}

fn unwrap_parens(s: &[char]) -> Vec<char> {
    let mut t = trim(s);
    while !t.is_empty() && t[0] == '(' && scan_balanced(&t, 0) == Some(t.len() - 1) {
        t = trim(&t[1..t.len() - 1]);
    }
    t
}

fn is_temp_name(s: &[char]) -> bool {
    if s.len() < 3 || s[0] != '_' || s[1] != 't' {
        return false;
    }
    s[2..].iter().all(char::is_ascii_digit) && s.len() > 2
}

fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

fn html_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            _ => out.push(c),
        }
    }
    out
}

enum FoldTok {
    Decl(String, usize, usize),
    Helper(bool, usize, usize),
}

fn find_fold_token(s: &[char], from: usize) -> Option<FoldTok> {
    let mut i = from;
    while i < s.len() {
        if eq_at(s, i, &to_chars("const")) {
            if let Some(j) = skip_spaces1(s, i + 5) {
                if s[j] == '_' && j + 1 < s.len() && s[j + 1] == 't' {
                    let mut k = j + 2;
                    let ds = k;
                    while k < s.len() && s[k].is_ascii_digit() {
                        k += 1;
                    }
                    if k > ds {
                        let name = from_chars(&s[j..k]);
                        let mut m = skip_spaces(s, k);
                        if m < s.len() && s[m] == '=' {
                            m = skip_spaces(s, m + 1);
                            if m < s.len() && s[m] == '(' {
                                return Some(FoldTok::Decl(name, m, i));
                            }
                        }
                    }
                }
            }
        }

        if eq_at(s, i, &to_chars("$__ssrText(")) {
            return Some(FoldTok::Helper(true, i + 10, i));
        }
        if eq_at(s, i, &to_chars("$__ssrLen(")) {
            return Some(FoldTok::Helper(false, i + 9, i));
        }
        i += 1;
    }
    None
}

fn fold_const_text(src: &[char]) -> Vec<char> {
    let consts = foldable_consts(src);
    let mut temps: HashMap<String, Option<String>> = HashMap::new();
    let mut edits: Vec<(usize, usize, String)> = Vec::new();

    let resolve = |raw: &[char], temps: &HashMap<String, Option<String>>| -> Option<String> {
        let arg = unwrap_parens(raw);
        if let Some(lit) = literal_content(&arg) {
            return Some(lit);
        }
        let arg_s = from_chars(&arg);
        if let Some(v) = consts.get(&arg_s) {
            return Some(v.clone());
        }
        if is_temp_name(&arg) {
            if let Some(Some(v)) = temps.get(&arg_s) {
                return Some(v.clone());
            }
        }
        None
    };

    let mut pos = 0;
    while let Some(tok) = find_fold_token(src, pos) {
        match tok {
            FoldTok::Decl(name, paren, _start) => {
                let close = match scan_balanced(src, paren) {
                    Some(c) => c,
                    None => {
                        pos = paren + 1;
                        continue;
                    }
                };
                let val = resolve(&trim(&src[paren + 1..close]), &temps);
                temps.insert(name, val);
                pos = close + 1;
            }
            FoldTok::Helper(is_text, paren, start) => {
                let close = match scan_balanced(src, paren) {
                    Some(c) => c,
                    None => {
                        pos = paren + 1;
                        continue;
                    }
                };
                let value = resolve(&trim(&src[paren + 1..close]), &temps);
                match value {
                    None => {
                        pos = paren + 1;
                    }
                    Some(v) => {
                        let text = if is_text {
                            serde_json::to_string(&html_escape(&v)).unwrap()
                        } else {
                            utf16_len(&v).to_string()
                        };
                        edits.push((start, close + 1, text));
                        pos = close + 1;
                    }
                }
            }
        }
    }
    apply_edits(src, &mut edits)
}

fn apply_edits(src: &[char], edits: &mut [(usize, usize, String)]) -> Vec<char> {
    if edits.is_empty() {
        return src.to_vec();
    }
    let mut out = src.to_vec();
    for i in (0..edits.len()).rev() {
        let (start, end, ref text) = edits[i];
        let mut new_out = out[..start].to_vec();
        new_out.extend_from_slice(&to_chars(text));
        new_out.extend_from_slice(&out[end..]);
        out = new_out;
    }
    out
}

fn drop_dead_temps(src: &[char]) -> Vec<char> {
    let consts = foldable_consts(src);
    let mut removals: Vec<(usize, usize)> = Vec::new();

    let mut pos = 0;
    while let Some((start, name, paren)) = next_temp_decl(src, pos) {
        let close = match scan_balanced(src, paren) {
            Some(c) => c,
            None => {
                pos = paren + 1;
                continue;
            }
        };
        let mut end = close + 1;
        if end < src.len() && src[end] == ';' {
            end += 1;
        }
        let expr = unwrap_parens(&src[paren + 1..close]);
        let is_const = literal_content(&expr).is_some() || consts.contains_key(&from_chars(&expr));
        if is_const {
            let scope_end = scan_balanced(src, end);
            let region: &[char] = match scope_end {
                Some(e) => &src[end..e],
                None => &src[end..],
            };
            if !has_bare_word(region, &name) {
                removals.push((start, end));
            }
        }
        pos = end;
    }
    if removals.is_empty() {
        return src.to_vec();
    }
    let mut out = src.to_vec();
    for i in (0..removals.len()).rev() {
        let (a, b) = removals[i];
        let mut new_out = out[..a].to_vec();
        new_out.extend_from_slice(&out[b..]);
        out = new_out;
    }
    out
}

fn next_temp_decl(src: &[char], from: usize) -> Option<(usize, String, usize)> {
    let mut i = from;
    while i < src.len() {
        if eq_at(src, i, &to_chars("const")) {
            if let Some(j) = skip_spaces1(src, i + 5) {
                if src[j] == '_' && j + 1 < src.len() && src[j + 1] == 't' {
                    let mut k = j + 2;
                    let ds = k;
                    while k < src.len() && src[k].is_ascii_digit() {
                        k += 1;
                    }
                    if k > ds {
                        let name = from_chars(&src[j..k]);
                        let mut m = skip_spaces(src, k);
                        if m < src.len() && src[m] == '=' {
                            m = skip_spaces(src, m + 1);
                            if m < src.len() && src[m] == '(' {
                                return Some((i, name, m));
                            }
                        }
                    }
                }
            }
        }
        i += 1;
    }
    None
}

fn has_bare_word(region: &[char], name: &str) -> bool {
    let pat = to_chars(name);
    if pat.is_empty() {
        return false;
    }
    let mut pos = 0;
    while let Some(at) = index_of(region, &pat, pos) {
        let before_ok = at == 0 || !is_word(region[at - 1]);
        let after = at + pat.len();
        let after_ok = after >= region.len() || !is_word(region[after]);
        if before_ok && after_ok {
            return true;
        }
        pos = at + 1;
    }
    false
}

fn is_simple_init(v: &[char]) -> bool {
    if v.is_empty() {
        return false;
    }

    let ident = {
        let c0 = v[0];
        if c0.is_ascii_alphabetic() || c0 == '_' || c0 == '$' {
            v[1..]
                .iter()
                .all(|&c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
        } else {
            false
        }
    };
    if ident {
        return true;
    }

    let mut i = 0;
    if v[i] == '-' {
        i += 1;
    }
    let ds = i;
    while i < v.len() && v[i].is_ascii_digit() {
        i += 1;
    }
    if i == ds {
        return false;
    }
    if i < v.len() && v[i] == '.' {
        i += 1;
        let fs = i;
        while i < v.len() && v[i].is_ascii_digit() {
            i += 1;
        }
        if i == fs {
            return false;
        }
    }
    i == v.len()
}

fn subst_in_code(s: &[char], subst: &[(String, String)]) -> Vec<char> {
    let apply = |code: &[char]| -> Vec<char> {
        let mut r = code.to_vec();
        for (n, v) in subst {
            r = replace_bare_word(&r, n, &to_chars(v));
        }
        r
    };
    let mut out: Vec<char> = Vec::new();
    let mut code: Vec<char> = Vec::new();
    let mut mode = Mode::Code;
    let mut stack: Vec<Br> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let c = s[i];
        match mode {
            Mode::Code => {
                if c == '\'' || c == '"' || c == '`' {
                    out.extend_from_slice(&apply(&code));
                    out.push(c);
                    code.clear();
                    mode = if c == '\'' {
                        Mode::Sq
                    } else if c == '"' {
                        Mode::Dq
                    } else {
                        Mode::Tmpl
                    };
                } else if c == '(' || c == '[' || c == '{' {
                    stack.push(Br::Open);
                    code.push(c);
                } else if c == ')' || c == ']' || c == '}' {
                    if let Some(Br::Tmpl) = stack.pop() {
                        out.extend_from_slice(&apply(&code));
                        out.push(c);
                        code.clear();
                        mode = Mode::Tmpl;
                    } else {
                        code.push(c);
                    }
                } else {
                    code.push(c);
                }
                i += 1;
            }
            Mode::Sq | Mode::Dq => {
                out.push(c);
                if c == '\\' {
                    i += 1;
                    if i < s.len() {
                        out.push(s[i]);
                    }
                } else if (mode == Mode::Sq && c == '\'') || (mode == Mode::Dq && c == '"') {
                    mode = Mode::Code;
                }
                i += 1;
            }
            Mode::Tmpl => {
                if c == '\\' {
                    out.push(c);
                    i += 1;
                    if i < s.len() {
                        out.push(s[i]);
                    }
                    i += 1;
                } else if c == '`' {
                    out.push(c);
                    mode = Mode::Code;
                    i += 1;
                } else if c == '$' && i + 1 < s.len() && s[i + 1] == '{' {
                    out.push('$');
                    out.push('{');
                    i += 2;
                    stack.push(Br::Tmpl);
                    mode = Mode::Code;
                } else {
                    out.push(c);
                    i += 1;
                }
            }
        }
    }
    out.extend_from_slice(&apply(&code));
    out
}

fn replace_bare_word(s: &[char], name: &str, to: &[char]) -> Vec<char> {
    let pat = to_chars(name);
    if pat.is_empty() {
        return s.to_vec();
    }
    let mut out = Vec::new();
    let mut i = 0;
    while i < s.len() {
        if eq_at(s, i, &pat) {
            let before_ok = i == 0 || !is_word(s[i - 1]);
            let after = i + pat.len();
            let after_ok = after >= s.len() || !is_word(s[after]);
            if before_ok && after_ok {
                out.extend_from_slice(to);
                i = after;
                continue;
            }
        }
        out.push(s[i]);
        i += 1;
    }
    out
}

fn collapse_iife(src: &[char]) -> Vec<char> {
    let mut edits: Vec<(usize, usize, String)> = Vec::new();

    let mut pos = 0;
    while let Some((m_index, brace)) = next_iife(src, pos) {
        let brace_close = match scan_balanced(src, brace) {
            Some(c) => c,
            None => {
                pos = m_index + 1;
                continue;
            }
        };
        if !eq_at(src, brace_close + 1, &to_chars(")()")) {
            pos = m_index + 1;
            continue;
        }
        let body = &src[brace + 1..brace_close];
        let mut subst: Vec<(String, String)> = Vec::new();
        let mut bpos = 0usize;
        let mut ok = true;
        loop {
            let rest = &body[bpos..];
            let sp = skip_spaces(rest, 0);
            if !eq_at(rest, sp, &to_chars("const")) {
                break;
            }
            let after_const = match skip_spaces1(rest, sp + 5) {
                Some(x) => x,
                None => break,
            };
            if !(rest[after_const] == '_'
                && after_const + 1 < rest.len()
                && rest[after_const + 1] == 't')
            {
                break;
            }
            let mut k = after_const + 2;
            let ds = k;
            while k < rest.len() && rest[k].is_ascii_digit() {
                k += 1;
            }
            if k == ds {
                break;
            }
            let name = from_chars(&rest[after_const..k]);
            let mut eq = skip_spaces(rest, k);
            if eq >= rest.len() || rest[eq] != '=' {
                break;
            }
            eq = skip_spaces(rest, eq + 1);
            if eq >= rest.len() || rest[eq] != '(' {
                break;
            }
            let paren_abs = bpos + eq;
            let close = match scan_balanced(body, paren_abs) {
                Some(c) => c,
                None => {
                    ok = false;
                    break;
                }
            };
            let init = unwrap_parens(&body[paren_abs + 1..close]);
            if !is_simple_init(&init) {
                ok = false;
                break;
            }
            subst.push((name, from_chars(&init)));
            let mut np = close + 1;
            if np < body.len() && body[np] == ';' {
                np += 1;
            }
            bpos = np;
        }

        let rest_after = &body[bpos.min(body.len())..];
        let ta = skip_spaces(rest_after, 0);
        let rest_trimmed = &rest_after[ta..];

        let return_ok = eq_at(rest_trimmed, 0, &to_chars("return"))
            && rest_trimmed.len() > 6
            && (is_space(rest_trimmed[6]) || rest_trimmed[6] == '`' || rest_trimmed[6] == '(');
        if !ok || !return_ok {
            pos = m_index + 1;
            continue;
        }

        let mut expr = trim(&rest_trimmed[6..]);
        if !expr.is_empty() && expr[expr.len() - 1] == ';' {
            expr = trim(&expr[..expr.len() - 1]);
        }
        let text = if !subst.is_empty() {
            from_chars(&subst_in_code(&expr, &subst))
        } else {
            from_chars(&expr)
        };
        edits.push((m_index, brace_close + 4, text));
        pos = brace_close + 4;
    }
    apply_edits(src, &mut edits)
}

fn next_iife(src: &[char], from: usize) -> Option<(usize, usize)> {
    let mut i = from;
    while i < src.len() {
        if eq_at(src, i, &to_chars("(()")) {
            let mut j = skip_spaces(src, i + 3);
            if eq_at(src, j, &to_chars("=>")) {
                j = skip_spaces(src, j + 2);
                if j < src.len() && src[j] == '{' {
                    return Some((i, j));
                }
            }
        }
        i += 1;
    }
    None
}

fn template_end(s: &[char], open: usize) -> Option<usize> {
    let mut i = open + 1;
    while i < s.len() {
        let c = s[i];
        if c == '\\' {
            i += 2;
            continue;
        }
        if c == '`' {
            return Some(i);
        }
        if c == '$' && i + 1 < s.len() && s[i + 1] == '{' {
            let close = scan_balanced(s, i + 1)?;
            i = close;
        }
        i += 1;
    }
    None
}

fn flatten_template_holes(src: &[char]) -> Vec<char> {
    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    let dollar = to_chars("${`");
    let mut cur = index_of(src, &dollar, 0);
    while let Some(i) = cur {
        if let Some(bt_close) = template_end(src, i + 2) {
            if bt_close + 1 < src.len() && src[bt_close + 1] == '}' {
                edits.push((i, bt_close + 2, from_chars(&src[i + 3..bt_close])));
                cur = index_of(src, &dollar, bt_close + 2);
                continue;
            }
        }
        cur = index_of(src, &dollar, i + 3);
    }
    apply_edits(src, &mut edits)
}

fn strip_ssr_tpl(src: &[char]) -> Vec<char> {
    let mut edits: Vec<(usize, usize, String)> = Vec::new();
    let pat = to_chars("$__ssrTpl(");
    let mut pos = 0;
    while let Some(at) = index_of(src, &pat, pos) {
        let paren = at + pat.len() - 1;
        let close = match scan_balanced(src, paren) {
            Some(c) => c,
            None => {
                pos = at + 1;
                continue;
            }
        };
        let args = top_level_args(src, paren, close);
        if args.len() == 1 && !args[0].is_empty() {
            edits.push((at, close + 1, args[0].clone()));
            pos = close + 1;
        } else {
            pos = at + 1;
        }
    }
    apply_edits(src, &mut edits)
}

pub fn optimise(src_str: &str, registry: &[ChildMeta]) -> (String, usize) {
    let mut reg: HashMap<String, ChildMeta> = HashMap::new();
    for m in registry {
        reg.insert(m.tag.clone(), m.clone());
    }
    let mut out = to_chars(src_str);
    let mut inlined = 0usize;
    let child_call = to_chars("$__ssrChild('");
    let mut cursor = 0usize;
    loop {
        let rel = search_ssr_child(&out, cursor);
        let call_start = match rel {
            Some(r) => r,
            None => break,
        };
        let _ = &child_call;
        let paren = match index_of(&out, &to_chars("("), call_start) {
            Some(p) => p,
            None => {
                cursor = call_start + 12;
                continue;
            }
        };
        let call_end = match scan_balanced(&out, paren) {
            Some(c) => c,
            None => {
                cursor = call_start + 12;
                continue;
            }
        };
        let args = top_level_args(&out, paren, call_end);
        let tag = args.first().and_then(|a| parse_quoted(a));
        let child = tag.as_ref().and_then(|t| reg.get(t));
        let slot_names = if args.len() >= 5 {
            parse_slot_names(args.get(4).map(String::as_str))
        } else {
            None
        };
        let bad = match child {
            None => true,
            Some(c) => !c.simple,
        } || args.len() < 2
            || args.len() > 5
            || (args.len() >= 5 && slot_names.is_none());
        if bad {
            cursor = call_start + 12;
            continue;
        }
        let child = child.unwrap().clone();
        let replacement = inline_child(
            &child,
            &split_props(&to_chars(&args[1])),
            &args[1],
            args.get(2).map(String::as_str),
            args.get(3).map(String::as_str),
            &slot_names,
        );
        let replacement = match replacement {
            Some(r) => r,
            None => {
                cursor = call_start + 12;
                continue;
            }
        };
        let mut new_out = out[..call_start].to_vec();
        new_out.extend_from_slice(&to_chars(&replacement));
        new_out.extend_from_slice(&out[call_end + 1..]);
        out = new_out;
        inlined += 1;
        cursor = call_start;
    }

    out = drop_dead_temps(&fold_const_text(&out));
    loop {
        let next = collapse_iife(&out);
        if next == out {
            break;
        }
        out = next;
    }
    out = strip_ssr_tpl(&out);
    loop {
        let next = flatten_template_holes(&out);
        if next == out {
            break;
        }
        out = next;
    }
    if inlined > 0 {
        let helpers = collect_ssr_helpers(&out);
        for helper in helpers {
            out = ensure_import(&out, &helper);
        }
    }
    (from_chars(&out), inlined)
}

fn search_ssr_child(out: &[char], cursor: usize) -> Option<usize> {
    let pat = to_chars("$__ssrChild('");
    let mut pos = cursor;
    while let Some(at) = index_of(out, &pat, pos) {
        let tag_start = at + pat.len();

        if let Some(q) = index_of(out, &to_chars("'"), tag_start) {
            if q > tag_start && q + 1 < out.len() && out[q + 1] == ',' {
                return Some(at);
            }
        }
        pos = at + 1;
    }
    None
}

fn parse_quoted(a: &str) -> Option<String> {
    let v: Vec<char> = a.chars().collect();
    if v.len() >= 3 && v[0] == '\'' && v[v.len() - 1] == '\'' {
        let inner = &v[1..v.len() - 1];
        if inner.is_empty() || inner.contains(&'\'') {
            return None;
        }
        return Some(inner.iter().collect());
    }
    None
}

fn collect_ssr_helpers(out: &[char]) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut order: Vec<String> = Vec::new();
    let pat = to_chars("$__ssr");
    let mut pos = 0;
    while let Some(at) = index_of(out, &pat, pos) {
        let before_ok = at == 0 || out[at - 1] != '$';
        let mut end = at + pat.len();
        let ws = end;
        while end < out.len() && is_word(out[end]) {
            end += 1;
        }
        if before_ok && end > ws {
            let name = from_chars(&out[at..end]);
            if seen.insert(name.clone()) {
                order.push(name);
            }
            pos = end;
        } else {
            pos = at + 1;
        }
    }
    order
}
