#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LineKind {
    Normal,
    Soft,
    Hard,
    Literal,
}

#[derive(Clone)]
pub enum Doc {
    Nil,
    Text(String),
    Line(LineKind),
    Concat(Vec<Doc>),
    Indent(Box<Doc>),
    Group(Box<Group>),
    Fill(Vec<Doc>),
    #[allow(dead_code)]
    IfBreak {
        brk: Box<Doc>,
        flat: Box<Doc>,
    },
    #[allow(dead_code)]
    LineSuffix(Box<Doc>),
    BreakParent,
}

#[derive(Clone)]
pub struct Group {
    pub contents: Doc,
    pub should_break: bool,
}

pub fn nil() -> Doc {
    Doc::Nil
}

pub fn text(s: impl Into<String>) -> Doc {
    Doc::Text(s.into())
}

pub fn concat(items: Vec<Doc>) -> Doc {
    Doc::Concat(items)
}

pub fn line() -> Doc {
    Doc::Line(LineKind::Normal)
}

pub fn softline() -> Doc {
    Doc::Line(LineKind::Soft)
}

pub fn hardline() -> Doc {
    Doc::Concat(vec![Doc::Line(LineKind::Hard), Doc::BreakParent])
}

pub fn literalline() -> Doc {
    Doc::Concat(vec![Doc::Line(LineKind::Literal), Doc::BreakParent])
}

pub fn group(contents: Doc) -> Doc {
    Doc::Group(Box::new(Group {
        contents,
        should_break: false,
    }))
}

#[cfg(test)]
pub fn group_break(contents: Doc) -> Doc {
    Doc::Group(Box::new(Group {
        contents,
        should_break: true,
    }))
}

pub fn indent(contents: Doc) -> Doc {
    Doc::Indent(Box::new(contents))
}

pub fn fill(items: Vec<Doc>) -> Doc {
    Doc::Fill(items)
}

#[cfg(test)]
pub fn if_break(brk: Doc, flat: Doc) -> Doc {
    Doc::IfBreak {
        brk: Box::new(brk),
        flat: Box::new(flat),
    }
}

#[cfg(test)]
pub fn line_suffix(contents: Doc) -> Doc {
    Doc::LineSuffix(Box::new(contents))
}

#[cfg(test)]
pub fn break_parent() -> Doc {
    Doc::BreakParent
}

pub fn join(sep: Doc, items: Vec<Doc>) -> Doc {
    let mut out = Vec::with_capacity(items.len().saturating_mul(2));
    for (i, item) in items.into_iter().enumerate() {
        if i > 0 {
            out.push(sep.clone());
        }
        out.push(item);
    }
    Doc::Concat(out)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Flat,
    Break,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum IndentStyle {
    Space,
    Tab,
}

pub struct Options {
    pub width: usize,
    pub tab_width: usize,
    pub indent_style: IndentStyle,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            width: 80,
            tab_width: 4,
            indent_style: IndentStyle::Space,
        }
    }
}

impl Options {
    pub fn indent(&self, cols: usize) -> String {
        match self.indent_style {
            IndentStyle::Space => " ".repeat(cols),
            IndentStyle::Tab => "\t".repeat(cols / self.tab_width),
        }
    }

    pub fn base_cols(&self, indent_chars: usize) -> usize {
        match self.indent_style {
            IndentStyle::Space => indent_chars,
            IndentStyle::Tab => indent_chars * self.tab_width,
        }
    }
}

fn propagate_breaks(doc: &mut Doc) -> bool {
    match doc {
        Doc::Nil | Doc::Text(_) => false,
        Doc::BreakParent => true,
        Doc::Line(k) => matches!(k, LineKind::Hard | LineKind::Literal),
        Doc::Concat(items) | Doc::Fill(items) => {
            let mut forced = false;
            for item in items {
                if propagate_breaks(item) {
                    forced = true;
                }
            }
            forced
        }
        Doc::Indent(inner) => propagate_breaks(inner),
        Doc::LineSuffix(inner) => {
            propagate_breaks(inner);
            false
        }
        Doc::IfBreak { brk, flat } => {
            propagate_breaks(brk);
            propagate_breaks(flat);
            false
        }
        Doc::Group(g) => {
            if propagate_breaks(&mut g.contents) {
                g.should_break = true;
            }
            g.should_break
        }
    }
}

type Cmd = (usize, Mode, Doc);

pub fn print(doc: Doc, opts: &Options) -> String {
    print_at(doc, opts, 0)
}

pub fn print_at(mut doc: Doc, opts: &Options, initial_indent: usize) -> String {
    propagate_breaks(&mut doc);

    let mut out = String::new();
    let mut pos = initial_indent;
    let mut cmds: Vec<Cmd> = vec![(initial_indent, Mode::Break, doc)];
    let mut line_suffixes: Vec<Cmd> = Vec::new();

    loop {
        let (ind, mode, d) = match cmds.pop() {
            Some(cmd) => cmd,
            None => {
                if line_suffixes.is_empty() {
                    break;
                }
                flush_line_suffixes(&mut cmds, &mut line_suffixes);
                continue;
            }
        };

        match d {
            Doc::Nil | Doc::BreakParent => {}
            Doc::Text(s) => {
                pos += s.chars().count();
                out.push_str(&s);
            }
            Doc::Concat(items) => {
                for item in items.into_iter().rev() {
                    cmds.push((ind, mode, item));
                }
            }
            Doc::Indent(inner) => cmds.push((ind + opts.tab_width, mode, *inner)),
            Doc::LineSuffix(inner) => line_suffixes.push((ind, mode, *inner)),
            Doc::IfBreak { brk, flat } => {
                let chosen = if mode == Mode::Break { *brk } else { *flat };
                cmds.push((ind, mode, chosen));
            }
            Doc::Line(kind) => handle_line(
                kind,
                ind,
                mode,
                &mut out,
                &mut pos,
                &mut cmds,
                &mut line_suffixes,
                opts,
            ),
            Doc::Group(g) => handle_group(*g, ind, mode, pos, &mut cmds, opts),
            Doc::Fill(parts) => {
                fill_step(parts, ind, mode, pos, opts, &mut cmds);
            }
        }
    }

    out
}

fn flush_line_suffixes(cmds: &mut Vec<Cmd>, line_suffixes: &mut Vec<Cmd>) {
    for s in std::mem::take(line_suffixes).into_iter().rev() {
        cmds.push(s);
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_line(
    kind: LineKind,
    ind: usize,
    mode: Mode,
    out: &mut String,
    pos: &mut usize,
    cmds: &mut Vec<Cmd>,
    line_suffixes: &mut Vec<Cmd>,
    opts: &Options,
) {
    let flat = mode == Mode::Flat && matches!(kind, LineKind::Normal | LineKind::Soft);
    if flat {
        if kind == LineKind::Normal {
            *pos += 1;
            out.push(' ');
        }
        return;
    }
    if !line_suffixes.is_empty() {
        cmds.push((ind, mode, Doc::Line(kind)));
        flush_line_suffixes(cmds, line_suffixes);
        return;
    }
    if kind == LineKind::Literal {
        out.push('\n');
        *pos = 0;
    } else {
        trim_trailing_blanks(out);
        out.push('\n');
        out.push_str(&opts.indent(ind));
        *pos = ind;
    }
}

fn handle_group(g: Group, ind: usize, mode: Mode, pos: usize, cmds: &mut Vec<Cmd>, opts: &Options) {
    if mode == Mode::Flat && !g.should_break {
        cmds.push((ind, Mode::Flat, g.contents));
        return;
    }
    let remaining = opts.width as i64 - pos as i64;
    let flat_cmd = (ind, Mode::Flat, g.contents.clone());
    if !g.should_break && fits(remaining, &flat_cmd, cmds, opts, false) {
        cmds.push((ind, Mode::Flat, g.contents));
    } else {
        cmds.push((ind, Mode::Break, g.contents));
    }
}

fn fits(mut remaining: i64, next: &Cmd, rest: &[Cmd], opts: &Options, must_be_flat: bool) -> bool {
    let mut cmds: Vec<Cmd> = vec![next.clone()];
    let mut rest_idx = rest.len();

    while remaining >= 0 {
        let (ind, mode, d) = match cmds.pop() {
            Some(cmd) => cmd,
            None => {
                if rest_idx == 0 {
                    return true;
                }
                rest_idx -= 1;
                cmds.push(rest[rest_idx].clone());
                continue;
            }
        };

        match d {
            Doc::Nil | Doc::BreakParent | Doc::LineSuffix(_) => {}
            Doc::Text(s) => remaining -= s.chars().count() as i64,
            Doc::Concat(items) | Doc::Fill(items) => {
                for item in items.into_iter().rev() {
                    cmds.push((ind, mode, item));
                }
            }
            Doc::Indent(inner) => cmds.push((ind + opts.tab_width, mode, *inner)),
            Doc::Group(g) => {
                if must_be_flat && g.should_break {
                    return false;
                }
                let gm = if g.should_break { Mode::Break } else { mode };
                cmds.push((ind, gm, g.contents));
            }
            Doc::IfBreak { brk, flat } => {
                let chosen = if mode == Mode::Break { *brk } else { *flat };
                cmds.push((ind, mode, chosen));
            }
            Doc::Line(kind) => match kind {
                LineKind::Hard | LineKind::Literal => return true,
                _ if mode == Mode::Break => return true,
                LineKind::Normal => remaining -= 1,
                LineKind::Soft => {}
            },
        }
    }

    false
}

fn fill_step(
    parts: Vec<Doc>,
    ind: usize,
    mode: Mode,
    pos: usize,
    opts: &Options,
    cmds: &mut Vec<Cmd>,
) {
    if parts.is_empty() {
        return;
    }
    let remaining = opts.width as i64 - pos as i64;

    let content = parts[0].clone();
    let content_flat: Cmd = (ind, Mode::Flat, content.clone());
    let content_fits = fits(remaining, &content_flat, &[], opts, true);

    if parts.len() == 1 {
        cmds.push(if content_fits {
            content_flat
        } else {
            (ind, Mode::Break, content)
        });
        return;
    }

    let whitespace = parts[1].clone();
    let ws_flat: Cmd = (ind, Mode::Flat, whitespace.clone());
    let ws_break: Cmd = (ind, Mode::Break, whitespace.clone());

    if parts.len() == 2 {
        if content_fits {
            cmds.push(ws_flat);
            cmds.push(content_flat);
        } else {
            cmds.push(ws_break);
            cmds.push((ind, Mode::Break, content));
        }
        return;
    }

    let rest: Vec<Doc> = parts[2..].to_vec();
    let remaining_cmd: Cmd = (ind, mode, Doc::Fill(rest));
    let second = parts[2].clone();
    let pair = Doc::Concat(vec![content.clone(), whitespace, second]);
    let pair_flat: Cmd = (ind, Mode::Flat, pair);
    let pair_fits = fits(remaining, &pair_flat, &[], opts, true);

    cmds.push(remaining_cmd);
    let (ws, cnt) = if pair_fits {
        (ws_flat, content_flat)
    } else if content_fits {
        (ws_break, content_flat)
    } else {
        (ws_break, (ind, Mode::Break, content))
    };
    cmds.push(ws);
    cmds.push(cnt);
}

fn trim_trailing_blanks(out: &mut String) {
    let trimmed = out.trim_end_matches([' ', '\t']);
    out.truncate(trimmed.len());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(doc: Doc, width: usize) -> String {
        print(
            doc,
            &Options {
                width,
                tab_width: 2,
                ..Options::default()
            },
        )
    }

    fn list() -> Doc {
        group(concat(vec![
            text("["),
            indent(concat(vec![softline(), text("a,"), line(), text("b")])),
            softline(),
            text("]"),
        ]))
    }

    #[test]
    fn group_stays_flat_when_it_fits() {
        assert_eq!(p(list(), 80), "[a, b]");
    }

    #[test]
    fn group_breaks_when_it_overflows() {
        assert_eq!(p(list(), 4), "[\n  a,\n  b\n]");
    }

    #[test]
    fn indent_applies_only_on_break() {
        let d = group(indent(concat(vec![softline(), text("x")])));
        assert_eq!(p(d.clone(), 80), "x");
        assert_eq!(p(d, 0), "\n  x");
    }

    #[test]
    fn hardline_always_breaks() {
        assert_eq!(
            p(concat(vec![text("a"), hardline(), text("b")]), 80),
            "a\nb"
        );
    }

    #[test]
    fn break_parent_forces_the_enclosing_group() {
        let d = group(concat(vec![
            text("("),
            softline(),
            text("x"),
            break_parent(),
            softline(),
            text(")"),
        ]));
        assert_eq!(p(d, 80), "(\nx\n)");
    }

    #[test]
    fn if_break_picks_by_mode() {
        assert_eq!(p(group(if_break(text("B"), text("F"))), 80), "F");
        assert_eq!(
            p(
                group(concat(vec![if_break(text("B"), text("F")), break_parent()])),
                80
            ),
            "B"
        );
    }

    #[test]
    fn fill_packs_greedily_to_width() {
        let words = fill(vec![text("aaa"), line(), text("bbb"), line(), text("ccc")]);
        assert_eq!(p(words.clone(), 7), "aaa bbb\nccc");
        assert_eq!(p(words, 80), "aaa bbb ccc");
    }

    #[test]
    fn fill_wraps_every_word_when_narrow() {
        let words = fill(vec![text("aa"), line(), text("bb"), line(), text("cc")]);
        assert_eq!(p(words, 2), "aa\nbb\ncc");
    }

    #[test]
    fn trailing_spaces_are_trimmed_on_break() {
        let d = group_break(concat(vec![text("a"), line(), text("b")]));
        assert_eq!(p(d, 80), "a\nb");
    }

    #[test]
    fn join_interleaves_a_separator() {
        let d = group(join(
            concat(vec![text(","), line()]),
            vec![text("a"), text("b"), text("c")],
        ));
        assert_eq!(p(d.clone(), 80), "a, b, c");
        assert_eq!(p(d, 2), "a,\nb,\nc");
    }

    #[test]
    fn line_suffix_defers_to_the_next_break() {
        let d = concat(vec![
            text("a"),
            line_suffix(text(" //c")),
            hardline(),
            text("b"),
        ]);
        assert_eq!(p(d, 80), "a //c\nb");
    }
}
