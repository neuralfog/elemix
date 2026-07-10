//! The type-judgment backend, behind a trait — the one step the Rust/oxc side
//! can't do natively (no checker). `TscOracle` shells out to the project's own
//! `tsc` (the native `tsgo` launcher on TypeScript 7, plain `tsc` on 5/6): it
//! writes the analyzer's overlays to temp sidecar files next to the originals,
//! type-checks just those under the project's tsconfig, and parses the CLI
//! diagnostics back. A native backend (ezno) can replace it via the same trait.

use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

/// An overlay file: the original source rewritten with type-assertions around
/// each hole. Written to a temp sidecar so `tsc` can check it from disk.
pub struct Overlay {
    pub path: String,
    pub content: String,
}

/// One raw semantic diagnostic from tsc, in OVERLAY coordinates (the analyzer
/// maps `start` back to a hole's original span before showing it).
#[derive(Deserialize, Debug)]
pub struct RawDiagnostic {
    pub file: String,
    pub start: u32,
    pub code: i64,
    pub category: String,
    pub message: String,
}

/// Swappable type-judgment backend: "type-check these files (some from memory)".
pub trait TypeOracle {
    fn check(
        &self,
        root: &str,
        overlays: &[Overlay],
        check: &[String],
    ) -> Result<Vec<RawDiagnostic>, String>;
}

/// Runs the project's `tsc` CLI over temp overlay sidecars.
pub struct TscOracle;

impl TypeOracle for TscOracle {
    fn check(
        &self,
        root: &str,
        overlays: &[Overlay],
        _check: &[String],
    ) -> Result<Vec<RawDiagnostic>, String> {
        run_tsc(root, overlays)
    }
}

/// A sidecar overlay on disk, paired with the original path + content so a tsc
/// diagnostic (sidecar path + line/col) can be mapped back to overlay coords.
struct Sidecar {
    path: PathBuf,
    orig: String,
    content: String,
}

fn run_tsc(root: &str, overlays: &[Overlay]) -> Result<Vec<RawDiagnostic>, String> {
    let root_path = Path::new(root);
    let pid = std::process::id();

    // 1. Write each overlay to a hidden sidecar NEXT TO its original, so the
    //    overlay's relative imports and `#alias/*` paths resolve identically.
    let mut sidecars = Vec::new();
    for (i, ov) in overlays.iter().enumerate() {
        let orig = Path::new(&ov.path);
        let dir = orig.parent().unwrap_or(root_path);
        let stem = orig.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let path = dir.join(format!(".{stem}.__elemix{pid}_{i}.ts"));
        std::fs::write(&path, &ov.content)
            .map_err(|e| format!("writing overlay {}: {e}", path.display()))?;
        sidecars.push(Sidecar {
            path,
            orig: ov.path.clone(),
            content: ov.content.clone(),
        });
    }

    // 2. A temp tsconfig that inherits the project's options (strict, paths, lib)
    //    but roots ONLY the sidecars — nothing else is checked.
    let files: Vec<String> = sidecars
        .iter()
        .map(|s| s.path.to_string_lossy().into_owned())
        .collect();
    let mut cfg = serde_json::json!({
        "files": files,
        "include": [],
        "compilerOptions": { "noEmit": true },
    });
    if let Some(base) = find_tsconfig(root_path) {
        cfg["extends"] = base.to_string_lossy().into_owned().into();
    } else {
        cfg["compilerOptions"]["strict"] = true.into();
        cfg["compilerOptions"]["skipLibCheck"] = true.into();
    }
    let tsconfig = root_path.join(format!(".tsconfig.__elemix{pid}.json"));
    let write_cfg = std::fs::write(&tsconfig, serde_json::to_vec(&cfg).unwrap())
        .map_err(|e| format!("writing tsconfig: {e}"));

    // 3. Run the project's tsc. A non-zero exit is EXPECTED (we WANT the errors).
    let tsc = tsc_bin(root_path);
    let output = write_cfg.and_then(|()| {
        Command::new(&tsc)
            .args(["--noEmit", "--pretty", "false", "-p"])
            .arg(&tsconfig)
            .current_dir(root_path)
            .output()
            .map_err(|e| {
                format!(
                    "could not launch tsc ({}): {e}. The analyzer needs the \
                     project's typescript installed.",
                    tsc.display()
                )
            })
    });

    // 4. Clean up temp files unconditionally.
    for s in &sidecars {
        let _ = std::fs::remove_file(&s.path);
    }
    let _ = std::fs::remove_file(&tsconfig);

    let output = output?;

    // 5. Parse `file(line,col): category TS####: message`, keep only sidecar
    //    diagnostics, and translate to overlay coords (path + byte offset).
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut diagnostics = Vec::new();
    for line in stdout.lines() {
        let Some(d) = parse_diagnostic(line) else {
            continue;
        };
        let name = file_name(&d.file);
        let Some(side) = sidecars
            .iter()
            .find(|s| s.path.file_name().and_then(|n| n.to_str()) == Some(name))
        else {
            continue;
        };
        diagnostics.push(RawDiagnostic {
            file: side.orig.clone(),
            start: line_col_to_byte(&side.content, d.line, d.col),
            code: d.code,
            category: d.category,
            message: d.message,
        });
    }
    Ok(diagnostics)
}

/// The project's tsc launcher (`node_modules/.bin/tsc`), which on TS 7 execs the
/// native `tsgo` binary. Falls back to a bare `tsc` on PATH.
fn tsc_bin(root: &Path) -> PathBuf {
    let name = if cfg!(windows) { "tsc.cmd" } else { "tsc" };
    let mut dir = Some(root);
    while let Some(d) = dir {
        let candidate = d.join("node_modules").join(".bin").join(name);
        if candidate.exists() {
            return candidate;
        }
        dir = d.parent();
    }
    PathBuf::from("tsc")
}

/// Nearest ancestor `tsconfig.json`, searched from the project root up.
fn find_tsconfig(root: &Path) -> Option<PathBuf> {
    let mut dir = Some(root);
    while let Some(d) = dir {
        let candidate = d.join("tsconfig.json");
        if candidate.exists() {
            return Some(candidate);
        }
        dir = d.parent();
    }
    None
}

struct ParsedLine {
    file: String,
    line: u32,
    col: u32,
    code: i64,
    category: String,
    message: String,
}

/// Parse one `--pretty false` line: `path(line,col): category TS####: message`.
fn parse_diagnostic(line: &str) -> Option<ParsedLine> {
    let open = line.find('(')?;
    let file = line[..open].to_string();
    let rest = &line[open + 1..];
    let comma = rest.find(',')?;
    let l: u32 = rest[..comma].parse().ok()?;
    let close = rest.find(')')?;
    let c: u32 = rest[comma + 1..close].parse().ok()?;
    let after = rest[close + 1..].strip_prefix(": ")?;
    let sp = after.find(' ')?;
    let category = after[..sp].to_string();
    let code_and_msg = after[sp + 1..].strip_prefix("TS")?;
    let colon = code_and_msg.find(':')?;
    let code: i64 = code_and_msg[..colon].parse().ok()?;
    let message = code_and_msg[colon + 1..].trim_start().to_string();
    Some(ParsedLine {
        file,
        line: l,
        col: c,
        code,
        category,
        message,
    })
}

/// tsc line/col (1-based, UTF-16 code units) -> UTF-8 byte offset in `content`.
fn line_col_to_byte(content: &str, line: u32, col: u32) -> u32 {
    let mut byte = 0usize;
    for (i, l) in content.split_inclusive('\n').enumerate() {
        if i as u32 + 1 == line {
            let mut units = 0u32;
            for ch in l.chars() {
                if units + 1 >= col {
                    break;
                }
                units += ch.len_utf16() as u32;
                byte += ch.len_utf8();
            }
            return byte as u32;
        }
        byte += l.len();
    }
    byte as u32
}

/// Last path segment, tolerant of either slash flavour tsc might emit.
fn file_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}
