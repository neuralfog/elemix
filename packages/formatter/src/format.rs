use crate::doc::Options;
use crate::html;
use crate::scan;

pub struct Formatted {
    pub output: String,
    pub templates: usize,
    pub changed: bool,
}

fn top_level(tpls: &[scan::Tpl]) -> Vec<&scan::Tpl> {
    tpls.iter()
        .filter(|t| !tpls.iter().any(|o| o.open < t.open && t.close < o.close))
        .collect()
}

fn format_one(src: &str, tpl: &scan::Tpl, opts: &Options) -> Option<String> {
    let was_multiline = src[tpl.open.get()..tpl.close.get()].contains('\n');
    let base_cols = opts.base_cols(tpl.base_indent);
    let content_indent = base_cols + opts.tab_width;
    let body = html::format_template(&tpl.statics, &tpl.holes, opts, content_indent)?;
    Some(reindent(&body, base_cols, opts, was_multiline))
}

fn changed_edit(src: &str, tpl: &scan::Tpl, opts: &Options) -> Option<String> {
    let edit = format_one(src, tpl, opts)?;
    (edit != src[tpl.open.get()..tpl.close.get()]).then_some(edit)
}

pub fn format_source(src: &str, opts: &Options) -> Formatted {
    let tpls = scan::scan(src);
    let templates = tpls.len();

    let mut output = src.to_string();
    let mut changed = false;
    for tpl in top_level(&tpls).iter().rev() {
        let Some(replacement) = changed_edit(src, tpl, opts) else {
            continue;
        };
        changed = true;
        output.replace_range(tpl.open.get()..tpl.close.get(), &replacement);
    }

    Formatted {
        output,
        templates,
        changed,
    }
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: &'static str,
    pub message: &'static str,
    pub source: &'static str,
    pub edit: String,
}

pub fn diagnose(src: &str, opts: &Options) -> Vec<Diagnostic> {
    let tpls = scan::scan(src);
    let lines = LineIndex::new(src);
    let mut out = Vec::new();
    for tpl in top_level(&tpls) {
        let Some(edit) = changed_edit(src, tpl, opts) else {
            continue;
        };
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

    fn position(&self, at: scan::ByteOffset) -> Position {
        let byte = at.get();
        let line = self.starts.partition_point(|&s| s <= byte) - 1;
        let character = self.src[self.starts[line]..byte]
            .chars()
            .map(char::len_utf16)
            .sum();
        Position { line, character }
    }
}

fn reindent(body: &str, base_cols: usize, opts: &Options, was_multiline: bool) -> String {
    if !body.contains('\n') && !was_multiline {
        return body.to_string();
    }
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
        assert_eq!(d.range.start.line, 1);
        assert_eq!(d.range.end.line, 3);
        assert_eq!(d.severity, "warning");
        let mut fixed = MESSY.to_string();
        let tpl = &scan::scan(MESSY)[0];
        fixed.replace_range(tpl.open.get()..tpl.close.get(), &d.edit);
        assert_eq!(fixed, TIDY);
    }

    #[test]
    fn diagnose_positions_count_utf16_units() {
        let src = "const s = '👍'; const t = tpl`<div>  <b>${x}</b>  </div>`;";
        let diags = diagnose(src, &opts());
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].range.start.line, 0);
        assert_eq!(diags[0].range.start.character, 30);
    }

    #[test]
    fn tab_indent_style_emits_tabs() {
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
        assert_eq!(format_source(&out, &opts).output, out);
    }

    #[test]
    fn print_width_is_configurable() {
        let src = "class C {\n    t = tpl`<a href=\"/x\" title=\"hello there\">link</a>`;\n}\n";
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
