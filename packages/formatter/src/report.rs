use similar::{ChangeTag, TextDiff};

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
const OK: Ink = Ink {
    rgb: (74, 222, 128),
    ansi: "32",
};
const TAG: Ink = Ink {
    rgb: (244, 114, 182),
    ansi: "35",
};
const MUTED: Ink = Ink {
    rgb: (110, 118, 129),
    ansi: "90",
};

const VERSION: &str = match option_env!("ELEMIX_VERSION") {
    Some(v) => v,
    None => env!("CARGO_PKG_VERSION"),
};

pub struct Stats {
    pub templates: usize,
    pub changed: usize,
    pub files: usize,
}

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

    fn gradient(&self, from: &Ink, to: &Ink, s: &str) -> String {
        if !self.on {
            return s.to_string();
        }
        if !self.truecolor {
            return self.fg(from, false, s);
        }
        let chars: Vec<char> = s.chars().collect();
        let last = chars.len().saturating_sub(1).max(1) as f32;
        let mut out = String::new();
        for (i, ch) in chars.iter().enumerate() {
            let t = i as f32 / last;
            let lerp = |a: u8, c: u8| (a as f32 + (c as f32 - a as f32) * t).round() as u8;
            let (r, g, bl) = (
                lerp(from.rgb.0, to.rgb.0),
                lerp(from.rgb.1, to.rgb.1),
                lerp(from.rgb.2, to.rgb.2),
            );
            out.push_str(&format!("\x1b[38;2;{r};{g};{bl}m{ch}"));
        }
        out.push_str("\x1b[0m");
        out
    }

    fn err(&self, s: &str) -> String {
        self.fg(&ERR, true, s)
    }
    pub fn ok(&self, s: &str) -> String {
        self.fg(&OK, true, s)
    }
    fn tag(&self, s: &str) -> String {
        self.fg(&TAG, false, s)
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

pub fn banner(p: &Palette) -> String {
    let bar = p.tag("▐▌");
    format!(
        "\n  {bar}  {} {} template-formatter\n  {bar}  {}\n\n",
        p.bold("elemix"),
        p.dim("·"),
        p.dim(&format!("v{VERSION}")),
    )
}

pub fn summary(stats: &Stats, write: bool, p: &Palette) -> String {
    let rule = p.gradient(&BRAND_A, &BRAND_B, &"─".repeat(54));
    let verdict = if stats.changed == 0 {
        p.ok("✓ all formatted")
    } else if write {
        p.ok(&format!(
            "✓ formatted {} file{}",
            stats.changed,
            s(stats.changed)
        ))
    } else {
        p.err(&format!(
            "✗ {} file{} {} formatting",
            stats.changed,
            s(stats.changed),
            if stats.changed == 1 { "needs" } else { "need" }
        ))
    };
    let verb = if write {
        "reformatted"
    } else {
        "would reformat"
    };
    format!(
        "  {rule}\n   {verdict}    {}    {}    {}\n\n",
        p.dim(&format!(
            "◆ {} template{}",
            stats.templates,
            s(stats.templates)
        )),
        p.dim(&format!("◇ {} {verb}", stats.changed)),
        p.dim(&format!("▣ {} file{}", stats.files, s(stats.files))),
    )
}

pub fn diff(path: &str, before: &str, after: &str, p: &Palette) -> String {
    let td = TextDiff::from_lines(before, after);
    let mut out = format!("  {}\n", p.dim(&short_path(path)));
    for group in td.grouped_ops(3) {
        for op in group {
            for change in td.iter_changes(&op) {
                let sign = match change.tag() {
                    ChangeTag::Delete => '-',
                    ChangeTag::Insert => '+',
                    ChangeTag::Equal => ' ',
                };
                let line = format!("{sign} {}", change.value().trim_end_matches('\n'));
                let rendered = match change.tag() {
                    ChangeTag::Delete => p.fg(&ERR, false, &line),
                    ChangeTag::Insert => p.fg(&OK, false, &line),
                    ChangeTag::Equal => p.dim(&line),
                };
                out.push_str("    ");
                out.push_str(&rendered);
                out.push('\n');
            }
        }
    }
    out.push('\n');
    out
}

fn s(n: usize) -> &'static str {
    if n == 1 {
        ""
    } else {
        "s"
    }
}

fn short_path(path: &str) -> String {
    let parts: Vec<&str> = path.rsplit(['/', '\\']).take(2).collect();
    parts.into_iter().rev().collect::<Vec<_>>().join("/")
}
