//! The Doc IR + printer - a Rust port of prettier's document algebra (the
//! Wadler-style fits/break machine + greedy `fill`). This is the generic engine:
//! it has ZERO html knowledge. The html -> Doc translation (next phase) and every
//! formatting rule sit on top of it. Ported faithfully because prettier is the
//! oracle (see spec.md) - the printer's decisions must match prettier's.
//!
//! De-risked first, in isolation, with hand-written expected output (see tests),
//! so a later formatting bug can't be blamed on the printer.
#![allow(dead_code)] // the html printer (next phase) is the consumer; tests exercise it now

/// A line break's flavour.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LineKind {
    /// A space when flat, a newline (+ indent) when broken.
    Normal,
    /// Nothing when flat, a newline (+ indent) when broken.
    Soft,
    /// Always a newline (+ indent); forces the enclosing group to break.
    Hard,
    /// Always a newline with NO re-indent (verbatim, for pre-like content).
    Literal,
}

/// The document intermediate representation.
#[derive(Clone)]
pub enum Doc {
    Nil,
    Text(String),
    Line(LineKind),
    Concat(Vec<Doc>),
    Indent(Box<Doc>),
    Group(Box<Group>),
    Fill(Vec<Doc>),
    IfBreak { brk: Box<Doc>, flat: Box<Doc> },
    LineSuffix(Box<Doc>),
    BreakParent,
}

#[derive(Clone)]
pub struct Group {
    pub contents: Doc,
    pub should_break: bool,
}

// -- builders ---------------------------------------------------------------

pub fn nil() -> Doc {
    Doc::Nil
}

pub fn text(s: impl Into<String>) -> Doc {
    Doc::Text(s.into())
}

pub fn concat(items: Vec<Doc>) -> Doc {
    Doc::Concat(items)
}

/// A space when flat, a newline when the enclosing group breaks.
pub fn line() -> Doc {
    Doc::Line(LineKind::Normal)
}

/// Nothing when flat, a newline when the enclosing group breaks.
pub fn softline() -> Doc {
    Doc::Line(LineKind::Soft)
}

/// Always a newline; forces every enclosing group to break.
pub fn hardline() -> Doc {
    Doc::Concat(vec![Doc::Line(LineKind::Hard), Doc::BreakParent])
}

/// Always a newline with no re-indent - for verbatim (pre-like) content.
pub fn literalline() -> Doc {
    Doc::Concat(vec![Doc::Line(LineKind::Literal), Doc::BreakParent])
}

pub fn group(contents: Doc) -> Doc {
    Doc::Group(Box::new(Group {
        contents,
        should_break: false,
    }))
}

/// A group forced to break (its lines always expand).
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

/// `brk` when the enclosing group breaks, `flat` when it stays flat.
pub fn if_break(brk: Doc, flat: Doc) -> Doc {
    Doc::IfBreak {
        brk: Box::new(brk),
        flat: Box::new(flat),
    }
}

/// Deferred content printed at the next line break (e.g. a trailing comment).
pub fn line_suffix(contents: Doc) -> Doc {
    Doc::LineSuffix(Box::new(contents))
}

pub fn break_parent() -> Doc {
    Doc::BreakParent
}

/// Interleave `items` with `sep`.
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

// -- printer ----------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Flat,
    Break,
}

/// Whether one indent level is rendered as a tab or as spaces.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum IndentStyle {
    Space,
    Tab,
}

pub struct Options {
    /// Max line width the printer wraps at.
    pub width: usize,
    /// Columns per indent level (spaces per level, or a tab's display width).
    pub tab_width: usize,
    /// Render indentation with tabs or spaces.
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
    /// Render `cols` columns of indentation in the configured style: that many
    /// spaces, or `cols / tab_width` tabs.
    pub fn indent(&self, cols: usize) -> String {
        match self.indent_style {
            IndentStyle::Space => " ".repeat(cols),
            IndentStyle::Tab => "\t".repeat(cols / self.tab_width),
        }
    }

    /// Columns for a source line's leading-whitespace CHAR count. In space mode a
    /// char is one column; in tab mode each char is a tab worth `tab_width`.
    pub fn base_cols(&self, indent_chars: usize) -> usize {
        match self.indent_style {
            IndentStyle::Space => indent_chars,
            IndentStyle::Tab => indent_chars * self.tab_width,
        }
    }
}

/// Mark every group that contains a forced break (a hardline or breakParent) as
/// should_break, propagating up through enclosing groups - prettier's
/// `propagateBreaks` pre-pass. Returns whether `doc` forces a break upward.
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
        // A line-suffix's own breaks don't force the parent to expand.
        Doc::LineSuffix(inner) => {
            propagate_breaks(inner);
            false
        }
        // if-break marks nested groups but doesn't itself bubble a break.
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

/// Print a document to a string at `opts.width`.
pub fn print(doc: Doc, opts: &Options) -> String {
    print_at(doc, opts, 0)
}

/// Print with every line (and the width budget) offset by `initial_indent`
/// columns - so a template body can be printed already sitting under its literal.
/// The very first line is emitted with no leading spaces (the caller prepends
/// them), but `pos` starts at `initial_indent` so widths and wrapping are honest.
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
                // Flush deferred line-suffixes in first-added order.
                for s in std::mem::take(&mut line_suffixes).into_iter().rev() {
                    cmds.push(s);
                }
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
            Doc::Line(kind) => {
                let flat = mode == Mode::Flat && matches!(kind, LineKind::Normal | LineKind::Soft);
                if flat {
                    if kind == LineKind::Normal {
                        pos += 1;
                        out.push(' ');
                    }
                    continue;
                }
                // A break: flush any pending line-suffixes onto this line first.
                if !line_suffixes.is_empty() {
                    cmds.push((ind, mode, Doc::Line(kind)));
                    for s in std::mem::take(&mut line_suffixes).into_iter().rev() {
                        cmds.push(s);
                    }
                    continue;
                }
                if kind == LineKind::Literal {
                    out.push('\n');
                    pos = 0;
                } else {
                    trim_trailing_blanks(&mut out);
                    out.push('\n');
                    out.push_str(&opts.indent(ind));
                    pos = ind;
                }
            }
            Doc::Group(g) => {
                let g = *g;
                if mode == Mode::Flat && !g.should_break {
                    cmds.push((ind, Mode::Flat, g.contents));
                    continue;
                }
                let remaining = opts.width as i64 - pos as i64;
                let flat_cmd = (ind, Mode::Flat, g.contents.clone());
                if !g.should_break
                    && fits(
                        remaining,
                        &flat_cmd,
                        &cmds,
                        !line_suffixes.is_empty(),
                        opts,
                        false,
                    )
                {
                    cmds.push((ind, Mode::Flat, g.contents));
                } else {
                    cmds.push((ind, Mode::Break, g.contents));
                }
            }
            Doc::Fill(parts) => {
                fill_step(
                    parts,
                    ind,
                    mode,
                    pos,
                    !line_suffixes.is_empty(),
                    opts,
                    &mut cmds,
                );
            }
        }
    }

    out
}

/// Does `next` (plus the continuation `rest`) fit in `remaining` columns before
/// the next line break? prettier's `fits`. `must_be_flat` fails on a forced-break
/// group (used by `fill`, which needs a truly flat trial).
fn fits(
    mut remaining: i64,
    next: &Cmd,
    rest: &[Cmd],
    _has_line_suffix: bool,
    opts: &Options,
    must_be_flat: bool,
) -> bool {
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

/// The greedy fill: pack as many items per line as fit. `parts` alternate
/// content, separator, content, separator, ... - prettier's fill printing.
fn fill_step(
    parts: Vec<Doc>,
    ind: usize,
    mode: Mode,
    pos: usize,
    has_line_suffix: bool,
    opts: &Options,
    cmds: &mut Vec<Cmd>,
) {
    if parts.is_empty() {
        return;
    }
    let remaining = opts.width as i64 - pos as i64;

    let content = parts[0].clone();
    let content_flat: Cmd = (ind, Mode::Flat, content.clone());
    let content_fits = fits(remaining, &content_flat, &[], has_line_suffix, opts, true);

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
    let pair_fits = fits(remaining, &pair_flat, &[], has_line_suffix, opts, true);

    // pop order is LIFO, so push remaining first, then separator, then content.
    if pair_fits {
        cmds.push(remaining_cmd);
        cmds.push(ws_flat);
        cmds.push(content_flat);
    } else if content_fits {
        cmds.push(remaining_cmd);
        cmds.push(ws_break);
        cmds.push(content_flat);
    } else {
        cmds.push(remaining_cmd);
        cmds.push(ws_break);
        cmds.push((ind, Mode::Break, content));
    }
}

/// Trim trailing spaces/tabs from the current (last) line before a hard newline.
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

    // A `[a, b]` list group: flat when it fits, one-per-line when it doesn't.
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
        // Fits easily, but break_parent expands every softline anyway.
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
        // width 7: "aaa bbb" fills the line (7 cols), "ccc" wraps.
        assert_eq!(p(words.clone(), 7), "aaa bbb\nccc");
        // wide: everything on one line.
        assert_eq!(p(words, 80), "aaa bbb ccc");
    }

    #[test]
    fn fill_wraps_every_word_when_narrow() {
        let words = fill(vec![text("aa"), line(), text("bb"), line(), text("cc")]);
        assert_eq!(p(words, 2), "aa\nbb\ncc");
    }

    #[test]
    fn trailing_spaces_are_trimmed_on_break() {
        // "a " then a hard break: the trailing space must be trimmed.
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
        // The suffix ("//c") is emitted at the newline, after "b".
        let d = concat(vec![
            text("a"),
            line_suffix(text(" //c")),
            hardline(),
            text("b"),
        ]);
        assert_eq!(p(d, 80), "a //c\nb");
    }
}
