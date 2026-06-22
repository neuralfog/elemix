//! The type-judgment backend, behind a trait — the one step the Rust/oxc side
//! can't do natively (no checker). `TscOracle` shells out to node running the
//! project's own `tsc`; a native backend (ezno) can replace it later via the
//! same trait, no rearchitecture. See ANALYZER.md.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// An overlay file served to tsc from memory — never written to the user's disk.
#[derive(Serialize)]
pub struct Overlay {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
struct Request<'a> {
    root: &'a str,
    overlays: &'a [Overlay],
    check: &'a [String],
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

#[derive(Deserialize)]
struct Response {
    ok: bool,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    diagnostics: Vec<RawDiagnostic>,
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

/// Spawns node over an embedded driver that runs the project's TypeScript.
pub struct TscOracle;

const DRIVER: &str = include_str!("../driver/analyze.mjs");

impl TypeOracle for TscOracle {
    fn check(
        &self,
        root: &str,
        overlays: &[Overlay],
        check: &[String],
    ) -> Result<Vec<RawDiagnostic>, String> {
        // Materialize the embedded driver next to a temp path so node can run it.
        // The binary stays self-contained — no path coordination with the launcher.
        let driver =
            std::env::temp_dir().join(format!("elemix-analyzer-{}.mjs", std::process::id()));
        std::fs::write(&driver, DRIVER).map_err(|e| format!("writing driver: {e}"))?;
        let result = run_node(&driver, root, overlays, check);
        let _ = std::fs::remove_file(&driver);
        result
    }
}

fn run_node(
    driver: &PathBuf,
    root: &str,
    overlays: &[Overlay],
    check: &[String],
) -> Result<Vec<RawDiagnostic>, String> {
    let request = serde_json::to_vec(&Request {
        root,
        overlays,
        check,
    })
    .map_err(|e| e.to_string())?;

    let mut child = Command::new("node")
        .arg(driver)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "could not launch node: {e}. The analyzer needs node + the project's typescript."
            )
        })?;

    // Drops (closes) stdin at the end of the statement so the driver's read loop ends.
    child
        .stdin
        .take()
        .unwrap()
        .write_all(&request)
        .map_err(|e| e.to_string())?;

    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!(
            "node driver failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    let response: Response = serde_json::from_slice(&out.stdout).map_err(|e| {
        format!(
            "bad driver response: {e}: {}",
            String::from_utf8_lossy(&out.stdout)
        )
    })?;
    if !response.ok {
        return Err(response
            .error
            .unwrap_or_else(|| "unknown oracle error".into()));
    }
    Ok(response.diagnostics)
}
