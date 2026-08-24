#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct ByteOffset(pub usize);

impl ByteOffset {
    pub fn get(self) -> usize {
        self.0
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct Tpl {
    pub open: ByteOffset,
    pub close: ByteOffset,
    pub base_indent: usize,
    pub statics: Vec<String>,
    pub holes: Vec<String>,
}

pub fn scan(src: &str) -> Vec<Tpl> {
    let b = src.as_bytes();
    let mut out = Vec::new();
    scan_region(b, 0, b.len(), &mut out);
    out.sort_by_key(|t| t.open);
    out
}

fn is_ident(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$'
}

fn skip_trivia(b: &[u8], i: usize, end: usize) -> Option<usize> {
    match b[i] {
        b'/' if i + 1 < end && b[i + 1] == b'/' => Some(skip_line_comment(b, i, end)),
        b'/' if i + 1 < end && b[i + 1] == b'*' => Some(skip_block_comment(b, i, end)),
        b'\'' | b'"' => Some(skip_string(b, i, end)),
        _ => None,
    }
}

fn scan_region(b: &[u8], start: usize, end: usize, out: &mut Vec<Tpl>) {
    let mut i = start;
    while i < end {
        if let Some(ni) = skip_trivia(b, i, end) {
            i = ni;
        } else if b[i] == b'`' {
            i = parse_template(b, i, end, out);
        } else {
            i += 1;
        }
    }
}

fn parse_template(b: &[u8], backtick: usize, end: usize, out: &mut Vec<Tpl>) -> usize {
    let tagged = tagged_tpl(b, backtick);
    let base_indent = line_indent(b, backtick);
    let open = backtick + 1;

    let mut statics = Vec::new();
    let mut holes = Vec::new();
    let mut chunk_start = open;
    let mut i = open;

    while i < end {
        match b[i] {
            b'\\' => i += 2,
            b'`' => {
                statics.push(slice(b, chunk_start, i));
                if tagged {
                    out.push(Tpl {
                        open: ByteOffset(open),
                        close: ByteOffset(i),
                        base_indent,
                        statics,
                        holes,
                    });
                }
                return i + 1;
            }
            b'$' if i + 1 < end && b[i + 1] == b'{' => {
                statics.push(slice(b, chunk_start, i));
                let hole_start = i + 2;
                let hole_end = find_hole_end(b, hole_start, end);
                holes.push(slice(b, hole_start, hole_end));
                scan_region(b, hole_start, hole_end, out);
                i = hole_end + 1;
                chunk_start = i;
            }
            _ => i += 1,
        }
    }
    end
}

fn tagged_tpl(b: &[u8], backtick: usize) -> bool {
    if backtick < 3 {
        return false;
    }
    if &b[backtick - 3..backtick] != b"tpl" {
        return false;
    }
    backtick < 4 || !is_ident(b[backtick - 4])
}

fn find_hole_end(b: &[u8], start: usize, end: usize) -> usize {
    let mut i = start;
    let mut depth = 1usize;
    while i < end {
        match b[i] {
            b'{' => {
                depth += 1;
                i += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return i;
                }
                i += 1;
            }
            b'`' => i = skip_template_raw(b, i, end),
            _ => {
                if let Some(ni) = skip_trivia(b, i, end) {
                    i = ni;
                } else {
                    i += 1;
                }
            }
        }
    }
    end
}

fn skip_template_raw(b: &[u8], backtick: usize, end: usize) -> usize {
    let mut i = backtick + 1;
    while i < end {
        match b[i] {
            b'\\' => i += 2,
            b'`' => return i + 1,
            b'$' if i + 1 < end && b[i + 1] == b'{' => {
                i = find_hole_end(b, i + 2, end) + 1;
            }
            _ => i += 1,
        }
    }
    end
}

fn skip_string(b: &[u8], quote_at: usize, end: usize) -> usize {
    let quote = b[quote_at];
    let mut i = quote_at + 1;
    while i < end {
        match b[i] {
            b'\\' => i += 2,
            x if x == quote => return i + 1,
            _ => i += 1,
        }
    }
    end
}

fn skip_line_comment(b: &[u8], start: usize, end: usize) -> usize {
    let mut i = start + 2;
    while i < end && b[i] != b'\n' {
        i += 1;
    }
    i
}

fn skip_block_comment(b: &[u8], start: usize, end: usize) -> usize {
    let mut i = start + 2;
    while i + 1 < end && !(b[i] == b'*' && b[i + 1] == b'/') {
        i += 1;
    }
    (i + 2).min(end)
}

fn line_indent(b: &[u8], pos: usize) -> usize {
    let mut line_start = pos;
    while line_start > 0 && b[line_start - 1] != b'\n' {
        line_start -= 1;
    }
    let mut n = 0;
    let mut i = line_start;
    while i < b.len() && (b[i] == b' ' || b[i] == b'\t') {
        n += 1;
        i += 1;
    }
    n
}

fn slice(b: &[u8], start: usize, stop: usize) -> String {
    String::from_utf8_lossy(&b[start..stop]).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_a_simple_template() {
        let ts = scan("const x = tpl`<div></div>`;");
        assert_eq!(ts.len(), 1);
        assert_eq!(ts[0].statics, vec!["<div></div>"]);
        assert!(ts[0].holes.is_empty());
        assert_eq!(
            &"const x = tpl`<div></div>`;"[ts[0].open.get()..ts[0].close.get()],
            "<div></div>"
        );
    }

    #[test]
    fn splits_statics_and_holes() {
        let ts = scan("tpl`<a>${x}</a>`");
        assert_eq!(ts.len(), 1);
        assert_eq!(ts[0].statics, vec!["<a>", "</a>"]);
        assert_eq!(ts[0].holes, vec!["x"]);
    }

    #[test]
    fn ignores_non_tpl_tags_and_plain_templates() {
        assert_eq!(scan("mytpl`<x/>`").len(), 0);
        assert_eq!(scan("const s = `plain ${x}`;").len(), 0);
    }

    #[test]
    fn ignores_tpl_inside_strings_and_comments() {
        assert_eq!(scan("const s = 'tpl`<x/>`';").len(), 0);
        assert_eq!(scan("// tpl`<x/>`\ncode;").len(), 0);
        assert_eq!(scan("/* tpl`<x/>` */").len(), 0);
    }

    #[test]
    fn balances_braces_inside_a_hole() {
        let ts = scan("tpl`${cond ? { a: 1 } : b}`");
        assert_eq!(ts[0].holes, vec!["cond ? { a: 1 } : b"]);
        assert_eq!(ts[0].statics, vec!["", ""]);
    }

    #[test]
    fn finds_a_nested_tpl_inside_a_hole() {
        let src = "tpl`<ul>${repeat(rows, (r) => tpl`<li>${r.t}</li>`)}</ul>`";
        let ts = scan(src);
        assert_eq!(ts.len(), 2, "outer + nested");
        let inner = ts.iter().find(|t| t.statics == vec!["<li>", "</li>"]);
        assert!(inner.is_some(), "nested li template found: {ts:?}");
    }

    #[test]
    fn records_the_line_indent() {
        let src = "class C {\n    t = tpl`<x/>`;\n}";
        let ts = scan(src);
        assert_eq!(ts[0].base_indent, 4);
    }

    #[test]
    fn handles_an_escaped_backtick_in_a_hole_string() {
        let ts = scan("tpl`<a>${'`'}</a>`");
        assert_eq!(ts.len(), 1);
        assert_eq!(ts[0].statics, vec!["<a>", "</a>"]);
    }
}
