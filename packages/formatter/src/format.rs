//! Orchestrate: scan a source for ``tpl`` `` literals, format each one's HTML, and
//! splice the result back in - preserving every byte outside a template and every
//! `${…}` hole. See spec.md.

use crate::doc::Options;
use crate::html;
use crate::scan;

pub struct Formatted {
    pub output: String,
    pub templates: usize,
    pub changed: bool,
}

/// Only the TOP-LEVEL templates in a source: a template nested inside another's
/// hole (e.g. a `repeat` render) is formatted by its parent, not independently -
/// splicing it separately would fight the parent splice and corrupt offsets.
fn top_level(tpls: &[scan::Tpl]) -> Vec<&scan::Tpl> {
    tpls.iter()
        .filter(|t| !tpls.iter().any(|o| o.open < t.open && t.close < o.close))
        .collect()
}

/// Format one located template's content (the bytes between the backticks),
/// ready to splice back over `src[tpl.open..tpl.close]`. `None` if it does not
/// parse (fail-soft: the caller leaves the original in place).
fn format_one(src: &str, tpl: &scan::Tpl, opts: &Options) -> Option<String> {
    // Respect the author's boundary: a template written on one line stays one
    // line (when it still fits), a multi-line one stays multi-line.
    let was_multiline = src[tpl.open..tpl.close].contains('\n');
    // Print already offset by the content indent (so widths and pre/verbatim
    // content are honest). Whether the result ends up single- or multi-line is
    // decided afterward by `reindent` - if a single-line body results, it has no
    // break lines, so the indent never mattered.
    let base_cols = opts.base_cols(tpl.base_indent);
    let content_indent = base_cols + opts.tab_width;
    let body = html::format_template(&tpl.statics, &tpl.holes, opts, content_indent)?;
    Some(reindent(&body, base_cols, opts, was_multiline))
}

/// Format every ``tpl`` `` template in a source file.
pub fn format_source(src: &str, opts: &Options) -> Formatted {
    let tpls = scan::scan(src);
    let templates = tpls.len();

    // Rebuild the file, splicing in each formatted template. Work back-to-front
    // so earlier byte offsets stay valid.
    let mut output = src.to_string();
    let mut changed = false;
    for tpl in top_level(&tpls).iter().rev() {
        let Some(replacement) = format_one(src, tpl, opts) else {
            continue; // fail-soft: unparseable template left as-is
        };
        if replacement != src[tpl.open..tpl.close] {
            changed = true;
            output.replace_range(tpl.open..tpl.close, &replacement);
        }
    }

    Formatted {
        output,
        templates,
        changed,
    }
}

/// An LSP-style position: 0-based line, 0-based UTF-16 code unit within the line
/// (the unit VS Code and the LSP spec address columns in).
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

/// An LSP-style half-open range `[start, end)`.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// One "this template is not formatted" diagnostic, over the template's content
/// span. `edit` is the formatted replacement for that exact range, so an editor
/// can offer a one-click fix without re-running the formatter. This is the ONLY
/// kind of diagnostic the formatter emits - correctness (props, directives, …)
/// is the analyzer's job, not ours.
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: &'static str,
    pub message: &'static str,
    pub source: &'static str,
    pub edit: String,
}

/// Report every top-level ``tpl`` `` template that is not already formatted, as a
/// diagnostic over its content span. Empty result == the file is fully formatted.
/// Coordinates are into the ORIGINAL `src` (positions never shift, since nothing
/// is spliced here). Unparseable templates yield no diagnostic (fail-soft).
pub fn diagnose(src: &str, opts: &Options) -> Vec<Diagnostic> {
    let tpls = scan::scan(src);
    let mut lines = LineIndex::new(src);
    let mut out = Vec::new();
    for tpl in top_level(&tpls) {
        let Some(edit) = format_one(src, tpl, opts) else {
            continue;
        };
        if edit == src[tpl.open..tpl.close] {
            continue;
        }
        out.push(Diagnostic {
            range: Range {
                start: lines.position(tpl.open),
                end: lines.position(tpl.close),
            },
            severity: "warning",
            message: "Template is not formatted",
            source: "etf",
            edit,
        });
    }
    out
}

/// Byte-offset -> LSP `Position`. Precomputes line-start offsets once so each
/// lookup is a binary search plus a UTF-16 count over the line's prefix.
struct LineIndex<'a> {
    src: &'a str,
    starts: Vec<usize>,
}

impl<'a> LineIndex<'a> {
    fn new(src: &'a str) -> Self {
        let mut starts = vec![0];
        starts.extend(src.match_indices('\n').map(|(i, _)| i + 1));
        Self { src, starts }
    }

    fn position(&mut self, byte: usize) -> Position {
        let line = self.starts.partition_point(|&s| s <= byte) - 1;
        let character = self.src[self.starts[line]..byte]
            .chars()
            .map(char::len_utf16)
            .sum();
        Position { line, character }
    }
}

/// Wrap the column-0 formatted HTML into a template body: a newline, the HTML
/// indented under the literal, then the closing backtick's indent.
///
/// ```text
/// tpl`
///     <div>…</div>
/// `
/// ```
fn reindent(body: &str, base_cols: usize, opts: &Options, was_multiline: bool) -> String {
    // A body that printed to a single line and was authored on one line stays a
    // single-line template (`tpl`<x/>``); don't blow it up into three lines.
    if !body.contains('\n') && !was_multiline {
        return body.to_string();
    }
    // The printer already indented every line but the first (it starts mid-line).
    // Prepend the content indent to that first line and wrap with the boundary
    // newlines + the closing backtick's indent. Verbatim (pre) lines, emitted at
    // column 0 by the printer, are left untouched - so re-running is a fixed point.
    let content_indent = opts.indent(base_cols + opts.tab_width);
    format!("\n{content_indent}{body}\n{}", opts.indent(base_cols))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts() -> Options {
        Options {
            width: 80,
            tab_width: 4,
            ..Options::default()
        }
    }

    fn fmt(src: &str) -> String {
        format_source(src, &opts()).output
    }

    // A full-file case: unformatted input -> the formatted whole file. Block
    // children (`li`) break one-per-line; the short inline `li` content stays flat.
    const MESSY: &str = "class C {\n    template = () => tpl`\n      <ul><li>one</li><li>${this.two}</li></ul>\n    `;\n}\n";
    const TIDY: &str = "class C {\n    template = () => tpl`\n        <ul>\n            <li>one</li>\n            <li>${this.two}</li>\n        </ul>\n    `;\n}\n";

    #[test]
    fn formats_a_whole_file() {
        assert_eq!(fmt(MESSY), TIDY);
    }

    #[test]
    fn is_idempotent() {
        let once = fmt(MESSY);
        assert_eq!(fmt(&once), once, "format(format(x)) must equal format(x)");
    }

    #[test]
    fn a_formatted_file_is_a_fixed_point() {
        assert_eq!(fmt(TIDY), TIDY);
        assert!(!format_source(TIDY, &opts()).changed);
    }

    #[test]
    fn leaves_non_template_files_byte_identical() {
        let src = "const x = 1;\nconst s = `not a tpl ${x}`;\n";
        let r = format_source(src, &opts());
        assert_eq!(r.output, src);
        assert!(!r.changed);
    }

    #[test]
    fn preserves_holes_byte_for_byte() {
        let src = "tpl`<a :p=${x.y ? '<z>' : q}>${this.v}</a>`";
        let out = fmt(src);
        assert!(
            out.contains("${x.y ? '<z>' : q}"),
            "attr hole intact: {out}"
        );
        assert!(out.contains("${this.v}"), "text hole intact: {out}");
    }

    #[test]
    fn diagnose_is_empty_for_a_formatted_file() {
        assert!(diagnose(TIDY, &opts()).is_empty());
    }

    #[test]
    fn diagnose_flags_an_unformatted_template_with_a_fix() {
        let diags = diagnose(MESSY, &opts());
        assert_eq!(diags.len(), 1);
        let d = &diags[0];
        // The range covers the content between the backticks (line 1, the `tpl\``
        // line), spanning onto the closing-backtick line.
        assert_eq!(d.range.start.line, 1);
        assert_eq!(d.range.end.line, 3);
        assert_eq!(d.severity, "warning");
        // The edit is the formatted replacement for that exact span - applying it
        // reproduces the fully-formatted file.
        let mut fixed = MESSY.to_string();
        let tpl = &scan::scan(MESSY)[0];
        fixed.replace_range(tpl.open..tpl.close, &d.edit);
        assert_eq!(fixed, TIDY);
    }

    #[test]
    fn diagnose_positions_count_utf16_units() {
        // An astral char before the template (👍 = 2 UTF-16 units) offsets columns.
        let src = "const s = '👍'; const t = tpl`<div>  <b>${x}</b>  </div>`;";
        let diags = diagnose(src, &opts());
        assert_eq!(diags.len(), 1);
        // The backtick content starts at UTF-16 unit 30; it would be 29 if the 👍
        // were a single BMP char, so this pins the surrogate-pair counting.
        assert_eq!(diags[0].range.start.line, 0);
        assert_eq!(diags[0].range.start.character, 30);
    }

    #[test]
    fn tab_indent_style_emits_tabs() {
        // A tab-indented source, formatted with indent_style = tab.
        let src =
            "class C {\n\ttemplate = () => tpl`\n\t\t<ul><li>one</li><li>two</li></ul>\n\t`;\n}\n";
        let opts = Options {
            width: 80,
            tab_width: 4,
            indent_style: crate::doc::IndentStyle::Tab,
        };
        let out = format_source(src, &opts).output;
        assert!(
            out.contains("\n\t\t<ul>"),
            "ul under the template at 2 tabs: {out:?}"
        );
        assert!(
            out.contains("\n\t\t\t<li>one</li>"),
            "li at 3 tabs: {out:?}"
        );
        assert!(out.contains("\n\t\t</ul>"), "closing ul at 2 tabs: {out:?}");
        assert!(
            !out.contains("\n    "),
            "no space indentation leaks in: {out:?}"
        );
        // Idempotent in tab mode too.
        assert_eq!(format_source(&out, &opts).output, out);
    }

    #[test]
    fn print_width_is_configurable() {
        let src = "class C {\n    t = tpl`<a href=\"/x\" title=\"hello there\">link</a>`;\n}\n";
        // Wide: stays on one line.
        let wide = format_source(
            src,
            &Options {
                width: 200,
                tab_width: 4,
                ..Options::default()
            },
        )
        .output;
        assert!(wide.contains("<a href=\"/x\" title=\"hello there\">link</a>"));
        // Narrow: the anchor's attributes wrap.
        let narrow = format_source(
            src,
            &Options {
                width: 20,
                tab_width: 4,
                ..Options::default()
            },
        )
        .output;
        assert!(
            narrow.contains("<a\n"),
            "attrs should wrap at width 20: {narrow}"
        );
    }
}
