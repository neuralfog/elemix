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

/// All overlays go under ONE throwaway cache dir (already git-ignored via
/// `node_modules`), never next to the user's sources. It is created fresh and
/// removed wholesale each run, so a stray file can never survive.
const CACHE_REL: &str = "node_modules/.cache/elemix-analyzer";

/// This process's private overlay dir, namespaced by pid so two analyzers on the
/// same project (an LSP server + a CLI `pn lint`, or parallel test runners) never
/// clobber each other's cache.
pub(crate) fn cache_dir(root: &Path) -> PathBuf {
    root.join(CACHE_REL).join(std::process::id().to_string())
}

fn run_tsc(root: &str, overlays: &[Overlay]) -> Result<Vec<RawDiagnostic>, String> {
    let root_path = Path::new(root);
    let cache = cache_dir(root_path);
    // Start from a clean slate (a prior crash may have left one behind).
    let _ = std::fs::remove_dir_all(&cache);

    // 1. Write each overlay into the cache, MIRRORING its path relative to the
    //    project root. Paired with `rootDirs: [root, cache]` below, this makes the
    //    overlay's relative imports (`./Sibling`) resolve to the real files, and
    //    `#alias/*` + bare packages resolve through the project's own tsconfig +
    //    node_modules — all without a single file landing beside the sources.
    let mut sidecars = Vec::new();
    for (i, ov) in overlays.iter().enumerate() {
        let orig = Path::new(&ov.path);
        let target = match orig.strip_prefix(root_path) {
            Ok(rel) => cache.join(rel),
            // A source outside the project root can't be mirrored; park it flat.
            Err(_) => cache.join(format!("__external{i}.ts")),
        };
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("creating overlay dir {}: {e}", parent.display()))?;
        }
        std::fs::write(&target, &ov.content)
            .map_err(|e| format!("writing overlay {}: {e}", target.display()))?;
        sidecars.push(Sidecar {
            path: target,
            orig: ov.path.clone(),
            content: ov.content.clone(),
        });
    }

    // 2. A temp tsconfig (also inside the cache) that inherits the project's options
    //    but roots ONLY the overlays, with `rootDirs` merging the cache over the
    //    real tree.
    let files: Vec<String> = sidecars
        .iter()
        .map(|s| s.path.to_string_lossy().into_owned())
        .collect();
    let mut cfg = serde_json::json!({
        "files": files,
        "include": [],
        "compilerOptions": {
            "noEmit": true,
            "rootDirs": [root_path.to_string_lossy(), cache.to_string_lossy()],
        },
    });
    if let Some(base) = find_tsconfig(root_path) {
        cfg["extends"] = base.to_string_lossy().into_owned().into();
    } else {
        cfg["compilerOptions"]["strict"] = true.into();
        cfg["compilerOptions"]["skipLibCheck"] = true.into();
    }
    let tsconfig = cache.join("tsconfig.json");
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

    // 4. Drop the ENTIRE cache dir - one wholesale removal, no per-file bookkeeping,
    //    no chance of a straggler.
    let _ = std::fs::remove_dir_all(&cache);

    let output = output?;

    Ok(parse_output(&output.stdout, &sidecars, root_path))
}

/// Parse `file(line,col): category TS####: message` lines, keep only overlay
/// diagnostics, and translate each to overlay coords (original path + byte offset).
/// Matches by full path (overlays share their originals' base names now).
fn parse_output(stdout: &[u8], sidecars: &[Sidecar], root: &Path) -> Vec<RawDiagnostic> {
    let stdout = String::from_utf8_lossy(stdout);
    let norm = |p: &str| p.replace('\\', "/");
    let mut diagnostics = Vec::new();
    for line in stdout.lines() {
        let Some(d) = parse_diagnostic(line) else {
            continue;
        };
        // tsc prints the overlay path relative to cwd (the root) or absolute.
        let abs = if Path::new(&d.file).is_absolute() {
            PathBuf::from(&d.file)
        } else {
            root.join(&d.file)
        };
        let abs = norm(&abs.to_string_lossy());
        let Some(side) = sidecars
            .iter()
            .find(|s| norm(&s.path.to_string_lossy()) == abs)
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
    diagnostics
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
