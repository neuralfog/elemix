//! Map tsc's overlay-coordinate diagnostics back to the real holes and render
//! them — `--pretty` carets into the original template, or `--lsp` JSON. Both
//! fall out of the same structured finding; pretty is rendered FROM it.

use crate::oracle::RawDiagnostic;
use crate::project::{BindKind, FileOverlay};
use elemix_compiler::{HintDiagnostic, HintKind, HintSeverity};

/// An RGB brand colour with a 16-colour ANSI fallback code, so the report looks
/// the part on truecolor terminals and still degrades cleanly on basic ones.
struct Ink {
    rgb: (u8, u8, u8),
    ansi: &'static str,
}

// elemix's palette — purple→cyan brand (the logo's lightning), plus the
// semantic signal colours. Tuned for dark terminals.
const BRAND_A: Ink = Ink {
    rgb: (167, 139, 250),
    ansi: "35",
}; // violet
const BRAND_B: Ink = Ink {
    rgb: (34, 211, 238),
    ansi: "36",
}; // cyan
const ERR: Ink = Ink {
    rgb: (248, 113, 113),
    ansi: "31",
}; // red
const WARN: Ink = Ink {
    rgb: (251, 191, 36),
    ansi: "33",
}; // amber
const OK: Ink = Ink {
    rgb: (74, 222, 128),
    ansi: "32",
}; // green
const TAG: Ink = Ink {
    rgb: (244, 114, 182),
    ansi: "35",
}; // pink
const PROP: Ink = Ink {
    rgb: (125, 211, 252),
    ansi: "36",
}; // sky
const MUTED: Ink = Ink {
    rgb: (110, 118, 129),
    ansi: "90",
}; // grey

/// Colouring for the human report. Off for `--lsp`, pipes, and `NO_COLOR`; uses
/// 24-bit truecolor when the terminal advertises it (`COLORTERM`), else the
/// ANSI-16 fallback. Every painted run is fully reset so plain mode is byte-clean.
pub struct Palette {
    on: bool,
    truecolor: bool,
}

impl Palette {
    pub fn new(on: bool) -> Self {
        let truecolor = std::env::var("COLORTERM")
            .map(|v| v.contains("truecolor") || v.contains("24bit"))
            .unwrap_or(false);
        Self { on, truecolor }
    }

    /// Foreground in an ink, optionally bold.
    fn fg(&self, ink: &Ink, bold: bool, s: &str) -> String {
        if !self.on {
            return s.to_string();
        }
        let b = if bold { "1;" } else { "" };
        let codes = if self.truecolor {
            let (r, g, bl) = ink.rgb;
            format!("{b}38;2;{r};{g};{bl}")
        } else {
            format!("{b}{}", ink.ansi)
        };
        format!("\x1b[{codes}m{s}\x1b[0m")
    }

    /// A filled "chip" — ink background, near-black bold text, padded.
    fn chip(&self, ink: &Ink, s: &str) -> String {
        if !self.on {
            return format!("[{}]", s.trim());
        }
        let bg = if self.truecolor {
            let (r, g, bl) = ink.rgb;
            format!("48;2;{r};{g};{bl}")
        } else {
            // 16-colour: background = ansi fg code + 10.
            format!("{}", ink.ansi.parse::<u32>().map(|n| n + 10).unwrap_or(47))
        };
        format!("\x1b[{bg};1;38;2;17;17;17m {s} \x1b[0m")
    }

    /// Background-highlight a token in place (the offending source span) — like
    /// [`chip`] but without the padding, so it sits flush inside the source line.
    fn highlight(&self, ink: &Ink, s: &str) -> String {
        if !self.on {
            return s.to_string();
        }
        let bg = if self.truecolor {
            let (r, g, bl) = ink.rgb;
            format!("48;2;{r};{g};{bl}")
        } else {
            format!("{}", ink.ansi.parse::<u32>().map(|n| n + 10).unwrap_or(47))
        };
        format!("\x1b[{bg};1;38;2;17;17;17m{s}\x1b[0m")
    }

    /// Per-character gradient between two inks (truecolor only; else brand-A bold).
    fn gradient(&self, from: &Ink, to: &Ink, bold: bool, s: &str) -> String {
        if !self.on {
            return s.to_string();
        }
        if !self.truecolor {
            return self.fg(from, bold, s);
        }
        let chars: Vec<char> = s.chars().collect();
        let last = chars.len().saturating_sub(1).max(1) as f32;
        let b = if bold { "1;" } else { "" };
        let mut out = String::new();
        for (i, ch) in chars.iter().enumerate() {
            let t = i as f32 / last;
            let lerp = |a: u8, c: u8| (a as f32 + (c as f32 - a as f32) * t).round() as u8;
            let (r, g, bl) = (
                lerp(from.rgb.0, to.rgb.0),
                lerp(from.rgb.1, to.rgb.1),
                lerp(from.rgb.2, to.rgb.2),
            );
            out.push_str(&format!("\x1b[{b}38;2;{r};{g};{bl}m{ch}"));
        }
        out.push_str("\x1b[0m");
        out
    }

    // Semantic shortcuts used by the renderer.
    fn err(&self, s: &str) -> String {
        self.fg(&ERR, true, s)
    }
    fn warn(&self, s: &str) -> String {
        self.fg(&WARN, true, s)
    }
    pub fn ok(&self, s: &str) -> String {
        self.fg(&OK, true, s)
    }
    fn tag(&self, s: &str) -> String {
        self.fg(&TAG, false, s)
    }
    fn prop(&self, s: &str) -> String {
        self.fg(&PROP, false, s)
    }
    /// A class identifier — violet, distinct from prop (sky) and tag (pink).
    fn cls(&self, s: &str) -> String {
        self.fg(&BRAND_A, false, s)
    }
    pub fn dim(&self, s: &str) -> String {
        self.fg(&MUTED, false, s)
    }
    /// Bold, no colour — for the banner wordmark (matches the compiler).
    fn bold(&self, s: &str) -> String {
        if self.on {
            format!("\x1b[1m{s}\x1b[0m")
        } else {
            s.to_string()
        }
    }
}

/// Version embedded at build time, Go-`ldflags` style — the npm `build` script
/// injects `package.json`'s version as `ELEMIX_VERSION`; a bare `cargo build`
/// falls back to the in-sync Cargo.toml version. Same mechanism as the compiler.
const VERSION: &str = match option_env!("ELEMIX_VERSION") {
    Some(v) => v,
    None => env!("CARGO_PKG_VERSION"),
};

/// What a finding is about — drives the subject line in the card.
pub enum Subject {
    /// A `:prop` binding on a tag (`:name on <user-card>`).
    Prop { prop: String, tag: String },
    /// An `@event`/`:ref`/`~model`/`~onmodel` binding (`label on <tag>`).
    Binding { label: String, tag: String },
    /// A required prop missing from a `<tag>` usage (no hole — carets the tag).
    Missing { tag: String },
    /// A `<tag>` usage whose component module may not be imported.
    Component { tag: String },
    /// An invalid custom-element tag on a component class.
    Tag { class: String },
    /// A malformed compiler hint, optionally attributed to a class.
    Hint { class: Option<String> },
}

/// A located, render-ready diagnostic — a prop type error or a compiler-hint
/// problem. `orig_start == orig_end` means there is no span to frame (a
/// file-level hint), so only the message is shown.
pub struct Finding {
    pub file: String,
    pub orig_start: usize,
    pub orig_end: usize,
    /// Short badge after the chip: `TS2345` for prop checks, `hint` for hints.
    pub badge: String,
    pub category: String,
    pub message: String,
    pub subject: Subject,
}

/// Attribute each raw diagnostic to the wrapped hole whose overlay range contains
/// it (in OVERLAY coords), then re-key it to that hole's original span. Diagnostics
/// outside every wrapper (the file's own pre-existing errors) are dropped.
pub fn attribute(raw: &[RawDiagnostic], overlays: &[FileOverlay]) -> Vec<Finding> {
    let mut out = Vec::new();
    for d in raw {
        let Some(ov) = overlays.iter().find(|o| o.path.to_string_lossy() == d.file) else {
            continue;
        };

        // A `__props<C>({…})` completeness check: a "missing" error means a REQUIRED
        // prop was left out. Carets the `<tag>` (the prop is absent, no hole to
        // point at). Non-missing errors here (an excess unknown prop) are dropped —
        // `__ck` already reports those precisely.
        if let Some(e) = ov
            .elements
            .iter()
            .find(|e| (d.start as usize) >= e.check_start && (d.start as usize) < e.check_end)
        {
            if let Some(missing) = parse_missing(&d.message) {
                let plural = if missing.len() == 1 { "" } else { "s" };
                out.push(Finding {
                    file: d.file.clone(),
                    orig_start: e.tag_orig_start,
                    orig_end: e.tag_orig_end,
                    badge: format!("TS{}", d.code),
                    category: d.category.clone(),
                    message: format!("missing required prop{plural}: {}", missing.join(", ")),
                    subject: Subject::Missing { tag: e.tag.clone() },
                });
            }
            continue;
        }

        let Some(h) = ov
            .holes
            .iter()
            .find(|h| (d.start as usize) >= h.wrap_start && (d.start as usize) < h.wrap_end)
        else {
            continue;
        };
        // For a `:prop`, tsc 2344 means the `'prop'` type argument isn't a key of
        // `Class['props']` — a prop name that doesn't exist (a typo); reframe it.
        // Other bindings carry tsc's own message (against EventListener / { value }
        // / the model contract), which is already on point.
        let (message, subject) = match &h.kind {
            BindKind::Prop(prop) => {
                let msg = if d.code == 2344 {
                    format!("<{}> has no prop '{}'", h.tag, prop)
                } else {
                    d.message.clone()
                };
                (
                    msg,
                    Subject::Prop {
                        prop: prop.clone(),
                        tag: h.tag.clone(),
                    },
                )
            }
            BindKind::Event(name) => (
                d.message.clone(),
                Subject::Binding {
                    label: format!("@{name}"),
                    tag: h.tag.clone(),
                },
            ),
            BindKind::Ref => (
                d.message.clone(),
                Subject::Binding {
                    label: ":ref".to_string(),
                    tag: h.tag.clone(),
                },
            ),
            BindKind::Model => (
                d.message.clone(),
                Subject::Binding {
                    label: "~model".to_string(),
                    tag: h.tag.clone(),
                },
            ),
            BindKind::OnModel => (
                d.message.clone(),
                Subject::Binding {
                    label: "~onmodel".to_string(),
                    tag: h.tag.clone(),
                },
            ),
        };
        out.push(Finding {
            file: d.file.clone(),
            orig_start: h.orig_start,
            orig_end: h.orig_end,
            badge: format!("TS{}", d.code),
            category: d.category.clone(),
            message,
            subject,
        });
    }
    out
}

/// Extract the missing required prop name(s) from a tsc message, handling both
/// the single form ("Property 'role' is missing in type …") and the multiple
/// form ("… is missing the following properties from type 'Props': role, age").
/// `None` when the message isn't a missing-property error.
fn parse_missing(msg: &str) -> Option<Vec<String>> {
    if let Some(i) = msg.find("is missing the following properties from type") {
        if let Some(c) = msg[i..].find(": ") {
            let list = msg[i + c + 2..].lines().next().unwrap_or("");
            let names: Vec<String> = list
                .split(',')
                .map(|s| s.trim().trim_matches('\'').to_string())
                .filter(|s| !s.is_empty() && !s.contains("more"))
                .collect();
            if !names.is_empty() {
                return Some(names);
            }
        }
    }
    if let Some(i) = msg.find("Property '") {
        let tail = &msg[i + "Property '".len()..];
        if let Some(end) = tail.find('\'') {
            if tail[end..].contains("is missing") {
                return Some(vec![tail[..end].to_string()]);
            }
        }
    }
    None
}

/// Turn the compiler's spanned hint diagnostics for one file into findings. A tag
/// problem is NOT a compiler hint — it's a check on the class's registered tag, so
/// it gets its own badge + subject.
pub fn hint_findings(file: &str, diags: Vec<HintDiagnostic>) -> Vec<Finding> {
    diags
        .into_iter()
        .map(|d| {
            let category = match d.severity {
                HintSeverity::Warning => "warning".to_string(),
                HintSeverity::Error => "error".to_string(),
            };
            let (badge, subject) = match d.kind {
                HintKind::Tag => (
                    "tag".to_string(),
                    Subject::Tag {
                        class: d.class.unwrap_or_default(),
                    },
                ),
                HintKind::Directive => ("hint".to_string(), Subject::Hint { class: d.class }),
            };
            Finding {
                file: file.to_string(),
                orig_start: d.start as usize,
                orig_end: d.end as usize,
                badge,
                category,
                message: d.message,
                subject,
            }
        })
        .collect()
}

/// Resolve an absolute byte offset to its line: 1-based line number, the line's
/// text, and the offset's BYTE position within that line.
fn locate(src: &str, offset: usize) -> (usize, &str, usize) {
    let line_start = src[..offset].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let line_end = src[offset..]
        .find('\n')
        .map(|i| offset + i)
        .unwrap_or(src.len());
    let line = src[..offset].bytes().filter(|&b| b == b'\n').count() + 1;
    (line, &src[line_start..line_end], offset - line_start)
}

/// Tallies for the summary dashboard.
pub struct Stats {
    pub components: usize,
    pub checked: usize,
    pub files: usize,
}

/// The header banner — the compiler's two-line brand, with the version baked in
/// at build time. Always shown (even on a clean run).
pub fn banner(p: &Palette) -> String {
    let bar = p.tag("▐▌");
    format!(
        "\n  {bar}  {} {} analyzer\n  {bar}  {}\n\n",
        p.bold("elemix"),
        p.dim("·"),
        p.dim(&format!("v{VERSION}")),
    )
}

/// Human render: one rich card per finding — severity chip, subject, and a code
/// frame with the offending token background-highlighted right in the source.
pub fn render_pretty(
    findings: &[Finding],
    source_of: impl Fn(&str) -> Option<String>,
    p: &Palette,
) -> String {
    let mut out = String::new();
    for f in findings {
        let Some(src) = source_of(&f.file) else {
            continue;
        };
        let warn = f.category == "warning";
        let ink = if warn { &WARN } else { &ERR };
        let mark = if warn { p.warn("▲") } else { p.err("✗") };
        let chip = if warn {
            p.chip(&WARN, "WARNING")
        } else {
            p.chip(&ERR, "ERROR")
        };

        // chip line + subject + locator
        out.push_str(&format!("  {mark} {chip} {}\n", p.dim(&f.badge)));
        out.push_str(&format!("    {}\n", subject_line(&f.subject, p)));

        // A zero-width span is a file-level finding — show the message only, no
        // code frame to anchor.
        if f.orig_end <= f.orig_start {
            out.push_str(&format!(
                "    {} {}\n",
                p.dim("↪"),
                p.dim(&short_path(&f.file))
            ));
            let msg = first_line(&f.message);
            let msg = if warn { p.warn(msg) } else { p.err(msg) };
            out.push_str(&format!(
                "    {} {}\n\n",
                if warn { p.warn("•") } else { p.err("•") },
                msg
            ));
            continue;
        }

        let (line, line_text, tok_at) = locate(&src, f.orig_start);

        // Slice the source line into [before][token][after] so the token can be
        // painted in place. Clamp the token end to the line (holes are single-line).
        let tok_end = (f.orig_end - (f.orig_start - tok_at)).min(line_text.len());
        let before = &line_text[..tok_at.min(line_text.len())];
        let token_raw = &line_text[tok_at.min(line_text.len())..tok_end];
        let after = &line_text[tok_end..];
        let token = if token_raw.is_empty() { " " } else { token_raw };

        let gw = line.to_string().len().max(2);
        let blank = " ".repeat(gw);
        let rail = p.dim("│");

        out.push_str(&format!(
            "    {} {}\n\n",
            p.dim("↪"),
            p.dim(&format!(
                "{}:{}:{}",
                short_path(&f.file),
                line,
                line_pos(before) + 1
            ))
        ));

        // code frame: gutter + source with the token lit up.
        out.push_str(&format!(
            "    {} {rail}  {before}{}{after}\n",
            p.dim(&format!("{line:>gw$}")),
            p.highlight(ink, token),
        ));

        // pointer row: underline beneath the token, then the message.
        let underline = "▔".repeat(token.chars().count().max(1));
        let underline = if warn {
            p.warn(&underline)
        } else {
            p.err(&underline)
        };
        let msg = first_line(&f.message);
        let msg = if warn { p.warn(msg) } else { p.err(msg) };
        out.push_str(&format!(
            "    {} {}  {}{} {}\n",
            p.dim(&blank),
            p.dim("╵"),
            " ".repeat(line_pos(before)),
            underline,
            msg,
        ));

        // continuation lines of a multi-line tsc message (union breakdowns, …).
        for extra in f.message.lines().skip(1) {
            out.push_str(&format!(
                "    {} {}   {}\n",
                p.dim(&blank),
                p.dim("╵"),
                p.dim(extra)
            ));
        }
        out.push('\n');
    }
    out
}

/// The subject line under the chip — what the finding is about.
fn subject_line(subject: &Subject, p: &Palette) -> String {
    match subject {
        Subject::Prop { prop, tag } => format!(
            "{} {} {}",
            p.prop(&format!(":{prop}")),
            p.dim("on"),
            p.tag(&format!("<{tag}>")),
        ),
        Subject::Binding { label, tag } => format!(
            "{} {} {}",
            p.prop(label),
            p.dim("on"),
            p.tag(&format!("<{tag}>")),
        ),
        Subject::Missing { tag } | Subject::Component { tag } => p.tag(&format!("<{tag}>")),
        Subject::Tag { class } => format!("{} {}", p.dim("tag of class"), p.cls(class)),
        // A class is NOT a tag — render it as a class identifier (no `<>`, which
        // would read as a custom-element tag; the real tag, if any, is in the
        // message).
        Subject::Hint { class: Some(c) } => {
            format!("{} {}", p.dim("compiler hint in class"), p.cls(c))
        }
        Subject::Hint { class: None } => p.dim("compiler hint"),
    }
}

/// The closing dashboard — verdict + what was covered.
pub fn summary(findings: &[Finding], stats: &Stats, p: &Palette) -> String {
    let errors = findings.iter().filter(|f| f.category != "warning").count();
    let warnings = findings.iter().filter(|f| f.category == "warning").count();

    let rule = p.gradient(&BRAND_A, &BRAND_B, false, &"─".repeat(54));
    let verdict = if errors == 0 {
        p.ok(&format!("✓ all clear{}", plural_warn(warnings)))
    } else {
        p.err(&format!(
            "✗ {errors} error{}{}",
            if errors == 1 { "" } else { "s" },
            plural_warn(warnings)
        ))
    };

    format!(
        "  {rule}\n   {verdict}    {}    {}    {}\n\n",
        p.dim(&format!(
            "◆ {} component{}",
            stats.components,
            s(stats.components)
        )),
        p.dim(&format!(
            "◇ {} binding{} checked",
            stats.checked,
            s(stats.checked)
        )),
        p.dim(&format!("▣ {} file{}", stats.files, s(stats.files))),
    )
}

fn plural_warn(n: usize) -> String {
    if n == 0 {
        String::new()
    } else {
        format!(" · {n} warning{}", s(n))
    }
}

fn s(n: usize) -> &'static str {
    if n == 1 {
        ""
    } else {
        "s"
    }
}

/// Display column (1-based) of a token given the text before it on its line.
fn line_pos(before: &str) -> usize {
    before.chars().count()
}

/// Last two path segments, for a compact locator (`fixtures/app.ts`).
fn short_path(path: &str) -> String {
    let parts: Vec<&str> = path.rsplit(['/', '\\']).take(2).collect();
    parts.into_iter().rev().collect::<Vec<_>>().join("/")
}

fn first_line(message: &str) -> &str {
    message.lines().next().unwrap_or(message)
}

/// LSP-shaped JSON: one object per finding with a 0-based range, severity, code,
/// message. A thin editor transport can sit on top later — not a new project.
pub fn render_lsp(findings: &[Finding], source_of: impl Fn(&str) -> Option<String>) -> String {
    let items: Vec<serde_json::Value> = findings
        .iter()
        .filter_map(|f| {
            let src = source_of(&f.file)?;
            let (sl, sline, sbyte) = locate(&src, f.orig_start);
            let (el, eline, ebyte) = locate(&src, f.orig_end);
            // LSP characters are 0-based code units within the line; approximate
            // with char counts of the line prefix (exact for the common ASCII case).
            let sc = sline[..sbyte.min(sline.len())].chars().count();
            let ec = eline[..ebyte.min(eline.len())].chars().count();
            Some(serde_json::json!({
                "file": f.file,
                "range": {
                    "start": { "line": sl - 1, "character": sc },
                    "end":   { "line": el - 1, "character": ec },
                },
                "severity": severity(&f.category),
                "code": f.badge,
                "source": "elemix-analyzer",
                "message": format!("{}{}", f.message, lsp_suffix(&f.subject)),
            }))
        })
        .collect();
    serde_json::to_string_pretty(&serde_json::json!(items)).unwrap_or_else(|_| "[]".into())
}

/// The ` (prop 'x' of <tag>)` / ` (<class>)` suffix appended to an LSP message.
fn lsp_suffix(subject: &Subject) -> String {
    match subject {
        Subject::Prop { prop, tag } => format!(" (prop '{prop}' of <{tag}>)"),
        Subject::Binding { label, tag } => format!(" ({label} on <{tag}>)"),
        Subject::Missing { tag } | Subject::Component { tag } => format!(" (<{tag}>)"),
        Subject::Tag { class } => format!(" (class {class})"),
        Subject::Hint { class: Some(c) } => format!(" (<{c}>)"),
        Subject::Hint { class: None } => String::new(),
    }
}

/// LSP DiagnosticSeverity: error 1, warning 2.
fn severity(category: &str) -> u8 {
    match category {
        "warning" => 2,
        _ => 1,
    }
}
