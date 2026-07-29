//! Precompiled `#styles` minification for the SSR `<style data-ssr>` block.
//!
//! Behind `--minify` the SSR pass resolves a component's stylesheet to its
//! literal CSS text — an inline `` `…` `` on the field, or a module-scope
//! `const css = `…`` the field names — and shrinks it at COMPILE time, so the
//! served HTML carries no authoring whitespace and no per-request cost. When the
//! CSS can't be seen as a static literal (imported, interpolated, or computed),
//! the caller keeps the dynamic `${expr}` emit: never wrong, just unminified.

/// The raw CSS a `#styles` initializer resolves to, or `None` when it isn't a
/// static literal this pass can see through. `expr` is the initializer source
/// (`` `…` `` or an identifier like `css`); `source` is the whole module.
pub fn resolve_css(expr: &str, source: &str) -> Option<String> {
    let expr = expr.trim();
    if let Some(inner) = backtick_inner(expr) {
        return Some(inner);
    }
    if is_ident(expr) {
        return const_template(expr, source);
    }
    None
}

fn is_ident(s: &str) -> bool {
    let mut chars = s.chars();
    matches!(chars.next(), Some(c) if c == '_' || c == '$' || c.is_ascii_alphabetic())
        && chars.all(|c| c == '_' || c == '$' || c.is_ascii_alphanumeric())
}

/// Inner text of a leading no-interpolation template literal, else `None`. An
/// escaped `` \` `` continues the literal; a `${` bails (dynamic, unresolvable).
fn backtick_inner(s: &str) -> Option<String> {
    let mut chars = s.char_indices();
    if chars.next()?.1 != '`' {
        return None;
    }
    let mut prev_dollar = false;
    while let Some((i, c)) = chars.next() {
        match c {
            '\\' => {
                chars.next();
                prev_dollar = false;
            }
            '`' => return Some(s[1..i].to_string()),
            '{' if prev_dollar => return None,
            _ => prev_dollar = c == '$',
        }
    }
    None
}

/// First module-scope `const|let|var <id> = `…`` whose literal has no
/// interpolation, returning its inner text. `None` if absent or interpolated
/// (imported/computed styles fall through to the dynamic emit).
fn const_template(id: &str, source: &str) -> Option<String> {
    for kw in ["const", "let", "var"] {
        let needle = format!("{kw} {id}");
        let mut from = 0;
        while let Some(rel) = source[from..].find(&needle) {
            let at = from + rel;
            let boundary = source[..at]
                .chars()
                .next_back()
                .is_none_or(|c| !(c == '_' || c == '$' || c.is_ascii_alphanumeric()));
            let rest = source[at + needle.len()..].trim_start();
            if boundary {
                if let Some(eq) = rest.strip_prefix('=') {
                    if let Some(inner) = backtick_inner(eq.trim_start()) {
                        return Some(inner);
                    }
                }
            }
            from = at + needle.len();
        }
    }
    None
}

const TIGHT_BEFORE: &[char] = &['{', '}', ';', ',', ':', '>'];
const TIGHT_AFTER: &[char] = &['{', '}', ';', ','];

/// Minify a CSS string: drop `/* … */` comments and authoring whitespace,
/// collapsing runs to a single space and eliding it entirely next to a
/// structural character. String literals (`"…"` / `'…'`) pass through verbatim,
/// so significant whitespace and delimiters inside them survive.
pub fn minify_css(css: &str) -> String {
    let chars: Vec<char> = css.chars().collect();
    let n = chars.len();
    let mut out = String::with_capacity(css.len());
    let mut i = 0;
    while i < n {
        let c = chars[i];
        if c == '"' || c == '\'' {
            out.push(c);
            i += 1;
            while i < n && chars[i] != c {
                if chars[i] == '\\' && i + 1 < n {
                    out.push(chars[i]);
                    i += 1;
                }
                out.push(chars[i]);
                i += 1;
            }
            if i < n {
                out.push(chars[i]);
                i += 1;
            }
            continue;
        }
        if c == '/' && i + 1 < n && chars[i + 1] == '*' {
            i += 2;
            while i + 1 < n && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i += 2;
            continue;
        }
        if c.is_whitespace() {
            let mut j = i;
            while j < n && chars[j].is_whitespace() {
                j += 1;
            }
            let prev = out.chars().next_back();
            let next = chars.get(j).copied();
            let drop = prev.is_none_or(|p| TIGHT_BEFORE.contains(&p))
                || next.is_none_or(|x| TIGHT_AFTER.contains(&x));
            if !drop {
                out.push(' ');
            }
            i = j;
            continue;
        }
        out.push(c);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapses_authoring_whitespace_and_tightens_structure() {
        let css = "\n    .card {\n        padding: 24px;\n        color: #fff;\n    }\n";
        assert_eq!(minify_css(css), ".card{padding:24px;color:#fff;}");
    }

    #[test]
    fn drops_comments() {
        assert_eq!(minify_css("a { /* hi */ color: red }"), "a{color:red}");
    }

    #[test]
    fn keeps_significant_space_between_values_and_in_selectors() {
        assert_eq!(
            minify_css("div  >  p { border: 1px  solid  red }"),
            "div >p{border:1px solid red}"
        );
        assert_eq!(minify_css("ul   li { color: red }"), "ul li{color:red}");
    }

    #[test]
    fn preserves_whitespace_inside_strings() {
        assert_eq!(
            minify_css("a::after { content: \"a   b\" }"),
            "a::after{content:\"a   b\"}"
        );
    }

    #[test]
    fn resolves_inline_and_const_literals_but_not_dynamic() {
        assert_eq!(
            resolve_css("`a { color: red }`", "").as_deref(),
            Some("a { color: red }")
        );
        assert_eq!(
            resolve_css("css", "const css = `b { color: blue }`;").as_deref(),
            Some("b { color: blue }")
        );
        assert_eq!(resolve_css("css", "const css = `x ${y}`;"), None);
        assert_eq!(resolve_css("makeStyles()", ""), None);
    }
}
