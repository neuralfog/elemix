use crate::oracle::RawDiagnostic;
use crate::project::{BindKind, FileOverlay, MetaOverlay, PropInfo, Registry};
use elemix_compiler::{scan_element_uses, HintDiagnostic, HintKind, HintSeverity};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

struct Ink {
    rgb: (u8, u8, u8),
    ansi: &'static str,
}

const BRAND_A: Ink = Ink {
    rgb: (167, 139, 250),
    ansi: "35",
};
const BRAND_B: Ink = Ink {
    rgb: (34, 211, 238),
    ansi: "36",
};
const ERR: Ink = Ink {
    rgb: (248, 113, 113),
    ansi: "31",
};
const WARN: Ink = Ink {
    rgb: (251, 191, 36),
    ansi: "33",
};
const OK: Ink = Ink {
    rgb: (74, 222, 128),
    ansi: "32",
};
const TAG: Ink = Ink {
    rgb: (244, 114, 182),
    ansi: "35",
};
const PROP: Ink = Ink {
    rgb: (125, 211, 252),
    ansi: "36",
};
const MUTED: Ink = Ink {
    rgb: (110, 118, 129),
    ansi: "90",
};

pub struct Palette {
    on: bool,
    truecolor: bool,
}

impl Palette {
    pub fn new(on: bool) -> Self {
        let truecolor = std::env::var("COLORTERM")
            .is_ok_and(|v| v.contains("truecolor") || v.contains("24bit"));
        Self { on, truecolor }
    }

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

    fn bg_code(&self, ink: &Ink) -> String {
        if self.truecolor {
            let (r, g, bl) = ink.rgb;
            format!("48;2;{r};{g};{bl}")
        } else {
            format!("{}", ink.ansi.parse::<u32>().map_or(47, |n| n + 10))
        }
    }

    fn chip(&self, ink: &Ink, s: &str) -> String {
        if !self.on {
            return format!("[{}]", s.trim());
        }
        let bg = self.bg_code(ink);
        format!("\x1b[{bg};1;38;2;17;17;17m {s} \x1b[0m")
    }

    fn highlight(&self, ink: &Ink, s: &str) -> String {
        if !self.on {
            return s.to_string();
        }
        let bg = self.bg_code(ink);
        format!("\x1b[{bg};1;38;2;17;17;17m{s}\x1b[0m")
    }

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
    fn cls(&self, s: &str) -> String {
        self.fg(&BRAND_A, false, s)
    }
    pub fn dim(&self, s: &str) -> String {
        self.fg(&MUTED, false, s)
    }
    fn bold(&self, s: &str) -> String {
        if self.on {
            format!("\x1b[1m{s}\x1b[0m")
        } else {
            s.to_string()
        }
    }
}

const VERSION: &str = match option_env!("ELEMIX_VERSION") {
    Some(v) => v,
    None => env!("CARGO_PKG_VERSION"),
};

pub enum Subject {
    Prop { prop: String, tag: String },
    Binding { label: String, tag: String },
    Missing { tag: String },
    Component { tag: String },
    Tag { class: String },
    Hint { class: Option<String> },
    Match,
}

pub struct Finding {
    pub file: String,
    pub orig_start: usize,
    pub orig_end: usize,
    pub badge: String,
    pub category: String,
    pub message: String,
    pub subject: Subject,
}

pub fn attribute(raw: &[RawDiagnostic], overlays: &[FileOverlay]) -> Vec<Finding> {
    let mut out = Vec::new();
    for d in raw {
        let Some(ov) = overlays.iter().find(|o| o.path.to_string_lossy() == d.file) else {
            continue;
        };

        if let Some(e) = ov
            .elements
            .iter()
            .find(|e| (d.start as usize) >= e.check_start && (d.start as usize) < e.check_end)
        {
            if let Some(missing) = parse_missing(&d.message) {
                out.push(Finding {
                    file: d.file.clone(),
                    orig_start: e.tag_orig_start,
                    orig_end: e.tag_orig_end,
                    badge: format!("TS{}", d.code),
                    category: d.category.clone(),
                    message: format!(
                        "missing required prop{}: {}",
                        s(missing.len()),
                        missing.join(", ")
                    ),
                    subject: Subject::Missing { tag: e.tag.clone() },
                });
            }
            continue;
        }

        let Some(h) = ov
            .holes
            .iter()
            .filter(|h| (d.start as usize) >= h.wrap_start && (d.start as usize) < h.wrap_end)
            .min_by_key(|h| h.wrap_end - h.wrap_start)
        else {
            continue;
        };
        let bind = |label: String| {
            (
                d.message.clone(),
                Subject::Binding {
                    label,
                    tag: h.tag.clone(),
                },
            )
        };
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
            BindKind::Event(name) => bind(format!("@{name}")),
            BindKind::Ref => bind(":ref".to_string()),
            BindKind::Model => bind("~model".to_string()),
            BindKind::OnModel => bind("~onmodel".to_string()),
            BindKind::Match => {
                let msg = if let Some(missing) = parse_missing(&d.message) {
                    format!(
                        "non-exhaustive match - missing case{}: {}",
                        s(missing.len()),
                        missing.join(", ")
                    )
                } else if d.message.contains("must be a finite literal-union or enum") {
                    "match() needs a finite value (a literal union or enum) - use choose() for open conditions"
                        .to_string()
                } else {
                    d.message.clone()
                };
                (msg, Subject::Match)
            }
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

pub fn duplicate_prop_findings(file: &str, source: &str, reg: &Registry) -> Vec<Finding> {
    let mut out = Vec::new();
    for u in scan_element_uses(source) {
        if !reg.contains_key(&u.tag) {
            continue;
        }
        let mut seen: HashSet<&String> = HashSet::new();
        let mut dupes: Vec<String> = Vec::new();
        for name in &u.provided {
            if !seen.insert(name) && !dupes.contains(name) {
                dupes.push(name.clone());
            }
        }
        for name in dupes {
            out.push(Finding {
                file: file.to_string(),
                orig_start: u.tag_start as usize,
                orig_end: u.tag_end as usize,
                badge: "props".to_string(),
                category: "error".to_string(),
                message: format!("duplicated prop '{name}' - bound more than once"),
                subject: Subject::Component { tag: u.tag.clone() },
            });
        }
    }
    out
}

pub fn attribute_metadata(
    raw: &[RawDiagnostic],
    meta: &MetaOverlay,
) -> HashMap<String, Vec<PropInfo>> {
    let meta_path = meta.path.to_string_lossy();
    let mut out = HashMap::new();
    for probe in &meta.probes {
        let mut all: Vec<String> = Vec::new();
        let mut required: Vec<String> = Vec::new();
        for d in raw {
            if d.file != meta_path {
                continue;
            }
            let at = d.start as usize;
            if at >= probe.all_start && at < probe.all_end {
                if let Some(names) = parse_missing(&d.message) {
                    all = names;
                }
            } else if at >= probe.req_start && at < probe.req_end {
                if let Some(names) = parse_missing(&d.message) {
                    required = names;
                }
            }
        }
        let props = all
            .into_iter()
            .map(|name| {
                let optional = !required.contains(&name);
                PropInfo { name, optional }
            })
            .collect();
        out.insert(probe.tag.clone(), props);
    }
    out
}

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

fn locate(src: &str, offset: usize) -> (usize, &str, usize) {
    let line_start = src[..offset].rfind('\n').map_or(0, |i| i + 1);
    let line_end = src[offset..].find('\n').map_or(src.len(), |i| offset + i);
    let line = src[..offset].bytes().filter(|&b| b == b'\n').count() + 1;
    (line, &src[line_start..line_end], offset - line_start)
}

pub struct Stats {
    pub components: usize,
    pub checked: usize,
    pub files: usize,
}

pub fn banner(p: &Palette) -> String {
    let bar = p.tag("▐▌");
    format!(
        "\n  {bar}  {} {} analyzer\n  {bar}  {}\n\n",
        p.bold("elemix"),
        p.dim("·"),
        p.dim(&format!("v{VERSION}")),
    )
}

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
        let warn = is_warning(f);
        let ink = if warn { &WARN } else { &ERR };
        let mark = if warn { p.warn("▲") } else { p.err("✗") };
        let chip = p.chip(ink, if warn { "WARNING" } else { "ERROR" });

        out.push_str(&format!("  {mark} {chip} {}\n", p.dim(&f.badge)));
        out.push_str(&format!("    {}\n", subject_line(&f.subject, p)));

        if f.orig_end <= f.orig_start {
            out.push_str(&render_headless(f, ink, p));
        } else {
            out.push_str(&render_span(f, &src, ink, p));
        }
    }
    out
}

fn render_headless(f: &Finding, ink: &Ink, p: &Palette) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "    {} {}\n",
        p.dim("↪"),
        p.dim(&short_path(&f.file))
    ));
    let msg = p.fg(ink, true, first_line(&f.message));
    out.push_str(&format!("    {} {}\n\n", p.fg(ink, true, "•"), msg));
    out
}

fn render_span(f: &Finding, src: &str, ink: &Ink, p: &Palette) -> String {
    let mut out = String::new();
    let (line, line_text, tok_at) = locate(src, f.orig_start);

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

    out.push_str(&format!(
        "    {} {rail}  {before}{}{after}\n",
        p.dim(&format!("{line:>gw$}")),
        p.highlight(ink, token),
    ));

    let underline = "▔".repeat(token.chars().count().max(1));
    let underline = p.fg(ink, true, &underline);
    let msg = p.fg(ink, true, first_line(&f.message));
    out.push_str(&format!(
        "    {} {}  {}{} {}\n",
        p.dim(&blank),
        p.dim("╵"),
        " ".repeat(line_pos(before)),
        underline,
        msg,
    ));

    for extra in f.message.lines().skip(1) {
        out.push_str(&format!(
            "    {} {}   {}\n",
            p.dim(&blank),
            p.dim("╵"),
            p.dim(extra)
        ));
    }
    out.push('\n');
    out
}

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
        Subject::Hint { class: Some(c) } => {
            format!("{} {}", p.dim("compiler hint in class"), p.cls(c))
        }
        Subject::Match => format!("{} {}", p.prop("match()"), p.dim("directive")),
        Subject::Hint { class: None } => p.dim("compiler hint"),
    }
}

pub fn summary(findings: &[Finding], stats: &Stats, p: &Palette) -> String {
    let errors = findings.iter().filter(|f| !is_warning(f)).count();
    let warnings = findings.iter().filter(|f| is_warning(f)).count();

    let rule = p.gradient(&BRAND_A, &BRAND_B, false, &"─".repeat(54));
    let verdict = if errors == 0 {
        p.ok(&format!("✓ all clear{}", plural_warn(warnings)))
    } else {
        p.err(&format!(
            "✗ {errors} error{}{}",
            s(errors),
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

fn line_pos(before: &str) -> usize {
    before.chars().count()
}

fn short_path(path: &str) -> String {
    let parts: Vec<&str> = path.rsplit(['/', '\\']).take(2).collect();
    parts.into_iter().rev().collect::<Vec<_>>().join("/")
}

fn first_line(message: &str) -> &str {
    message.lines().next().unwrap_or(message)
}

pub struct LspFinding {
    pub file: String,
    pub start_line: u32,
    pub start_char: u32,
    pub end_line: u32,
    pub end_char: u32,
    pub severity: u8,
    pub code: String,
    pub message: String,
}

pub fn render_json(findings: &[Finding], source_of: impl Fn(&str) -> Option<String>) -> String {
    let items: Vec<serde_json::Value> = lsp_findings(findings, source_of)
        .into_iter()
        .map(|f| {
            serde_json::json!({
                "file": f.file,
                "range": {
                    "start": { "line": f.start_line, "character": f.start_char },
                    "end":   { "line": f.end_line,   "character": f.end_char },
                },
                "severity": f.severity,
                "code": f.code,
                "source": "elemix-analyzer",
                "message": f.message,
            })
        })
        .collect();
    serde_json::to_string_pretty(&serde_json::json!(items)).unwrap_or_else(|_| "[]".into())
}

pub fn lsp_findings(
    findings: &[Finding],
    source_of: impl Fn(&str) -> Option<String>,
) -> Vec<LspFinding> {
    findings
        .iter()
        .filter_map(|f| {
            let src = source_of(&f.file)?;
            let (sl, sline, sbyte) = locate(&src, f.orig_start);
            let (el, eline, ebyte) = locate(&src, f.orig_end);
            let sc = sline[..sbyte.min(sline.len())].chars().count() as u32;
            let ec = eline[..ebyte.min(eline.len())].chars().count() as u32;
            Some(LspFinding {
                file: f.file.clone(),
                start_line: sl as u32 - 1,
                start_char: sc,
                end_line: el as u32 - 1,
                end_char: ec,
                severity: severity(&f.category),
                code: f.badge.clone(),
                message: format!("{}{}", f.message, lsp_suffix(&f.subject)),
            })
        })
        .collect()
}

fn lsp_suffix(subject: &Subject) -> String {
    match subject {
        Subject::Prop { prop, tag } => format!(" (prop '{prop}' of <{tag}>)"),
        Subject::Binding { label, tag } => format!(" ({label} on <{tag}>)"),
        Subject::Missing { tag } | Subject::Component { tag } => format!(" (<{tag}>)"),
        Subject::Tag { class } => format!(" (class {class})"),
        Subject::Hint { class: Some(c) } => format!(" (<{c}>)"),
        Subject::Match => " (match)".to_string(),
        Subject::Hint { class: None } => String::new(),
    }
}

fn severity(category: &str) -> u8 {
    match category {
        "warning" => 2,
        _ => 1,
    }
}

pub(crate) fn is_warning(f: &Finding) -> bool {
    f.category == "warning"
}

pub(crate) fn source_map(files: &[(PathBuf, String)]) -> HashMap<String, String> {
    files
        .iter()
        .map(|(p, src)| (p.to_string_lossy().into_owned(), src.clone()))
        .collect()
}
