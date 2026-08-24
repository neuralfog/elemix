use serde::Deserialize;
use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug)]
pub enum OracleError {
    OverlayDir { path: PathBuf, source: io::Error },
    OverlayWrite { path: PathBuf, source: io::Error },
    Tsconfig(io::Error),
    Tsc { bin: PathBuf, source: io::Error },
}

impl std::fmt::Display for OracleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OracleError::OverlayDir { path, source } => {
                write!(f, "creating overlay dir {}: {source}", path.display())
            }
            OracleError::OverlayWrite { path, source } => {
                write!(f, "writing overlay {}: {source}", path.display())
            }
            OracleError::Tsconfig(source) => write!(f, "writing tsconfig: {source}"),
            OracleError::Tsc { bin, source } => write!(
                f,
                "could not launch tsc ({}): {source}. The analyzer needs the \
                 project's typescript installed.",
                bin.display()
            ),
        }
    }
}

impl std::error::Error for OracleError {}

pub struct Overlay {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize, Debug)]
pub struct RawDiagnostic {
    pub file: String,
    pub start: u32,
    pub code: i64,
    pub category: String,
    pub message: String,
}

pub trait TypeOracle {
    fn check(&self, root: &str, overlays: &[Overlay]) -> Result<Vec<RawDiagnostic>, OracleError>;
}

pub struct TscOracle;

impl TypeOracle for TscOracle {
    fn check(&self, root: &str, overlays: &[Overlay]) -> Result<Vec<RawDiagnostic>, OracleError> {
        run_tsc(root, overlays)
    }
}

struct Sidecar {
    path: PathBuf,
    orig: String,
    content: String,
}

const CACHE_REL: &str = "node_modules/.cache/elemix-analyzer";

pub(crate) fn cache_dir(root: &Path) -> PathBuf {
    root.join(CACHE_REL).join(std::process::id().to_string())
}

fn run_tsc(root: &str, overlays: &[Overlay]) -> Result<Vec<RawDiagnostic>, OracleError> {
    let root_path = Path::new(root);
    let cache = cache_dir(root_path);
    let _ = std::fs::remove_dir_all(&cache);

    let sidecars = write_sidecars(root_path, overlays, &cache)?;

    let output = write_tsconfig(root_path, &cache, &sidecars)
        .and_then(|tsconfig| spawn_tsc(root_path, &tsconfig));

    let _ = std::fs::remove_dir_all(&cache);

    let output = output?;
    Ok(parse_output(&output.stdout, &sidecars, root_path))
}

fn write_sidecars(
    root: &Path,
    overlays: &[Overlay],
    cache: &Path,
) -> Result<Vec<Sidecar>, OracleError> {
    let mut sidecars = Vec::new();
    for (i, ov) in overlays.iter().enumerate() {
        let orig = Path::new(&ov.path);
        let target = match orig.strip_prefix(root) {
            Ok(rel) => cache.join(rel),
            Err(_) => cache.join(format!("__external{i}.ts")),
        };
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|source| OracleError::OverlayDir {
                path: parent.to_path_buf(),
                source,
            })?;
        }
        std::fs::write(&target, &ov.content).map_err(|source| OracleError::OverlayWrite {
            path: target.clone(),
            source,
        })?;
        sidecars.push(Sidecar {
            path: target,
            orig: ov.path.clone(),
            content: ov.content.clone(),
        });
    }
    Ok(sidecars)
}

fn write_tsconfig(root: &Path, cache: &Path, sidecars: &[Sidecar]) -> Result<PathBuf, OracleError> {
    let files: Vec<String> = sidecars
        .iter()
        .map(|s| s.path.to_string_lossy().into_owned())
        .collect();
    let mut cfg = serde_json::json!({
        "files": files,
        "include": [],
        "compilerOptions": {
            "noEmit": true,
            "rootDirs": [root.to_string_lossy(), cache.to_string_lossy()],
        },
    });
    if let Some(base) = find_tsconfig(root) {
        cfg["extends"] = base.to_string_lossy().into_owned().into();
    } else {
        cfg["compilerOptions"]["strict"] = true.into();
        cfg["compilerOptions"]["skipLibCheck"] = true.into();
    }
    let tsconfig = cache.join("tsconfig.json");
    std::fs::write(&tsconfig, serde_json::to_vec(&cfg).unwrap()).map_err(OracleError::Tsconfig)?;
    Ok(tsconfig)
}

fn spawn_tsc(root: &Path, tsconfig: &Path) -> Result<std::process::Output, OracleError> {
    let tsc = tsc_bin(root);
    Command::new(&tsc)
        .args(["--noEmit", "--pretty", "false", "-p"])
        .arg(tsconfig)
        .current_dir(root)
        .output()
        .map_err(|source| OracleError::Tsc {
            bin: tsc.clone(),
            source,
        })
}

fn parse_output(stdout: &[u8], sidecars: &[Sidecar], root: &Path) -> Vec<RawDiagnostic> {
    let stdout = String::from_utf8_lossy(stdout);
    let norm = |p: &str| p.replace('\\', "/");
    let mut by_path: HashMap<String, &Sidecar> = HashMap::new();
    for s in sidecars {
        by_path.entry(norm(&s.path.to_string_lossy())).or_insert(s);
    }
    let mut diagnostics = Vec::new();
    for line in stdout.lines() {
        let Some(d) = parse_diagnostic(line) else {
            continue;
        };
        let abs = if Path::new(&d.file).is_absolute() {
            PathBuf::from(&d.file)
        } else {
            root.join(&d.file)
        };
        let abs = norm(&abs.to_string_lossy());
        let Some(side) = by_path.get(&abs) else {
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

fn find_upwards(root: &Path, candidate: impl Fn(&Path) -> PathBuf) -> Option<PathBuf> {
    let mut dir = Some(root);
    while let Some(d) = dir {
        let path = candidate(d);
        if path.exists() {
            return Some(path);
        }
        dir = d.parent();
    }
    None
}

fn tsc_bin(root: &Path) -> PathBuf {
    let name = if cfg!(windows) { "tsc.cmd" } else { "tsc" };
    find_upwards(root, |d| d.join("node_modules").join(".bin").join(name))
        .unwrap_or_else(|| PathBuf::from("tsc"))
}

fn find_tsconfig(root: &Path) -> Option<PathBuf> {
    find_upwards(root, |d| d.join("tsconfig.json"))
}

struct ParsedLine {
    file: String,
    line: u32,
    col: u32,
    code: i64,
    category: String,
    message: String,
}

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
