//! `ec-analyzer` (`ea`) — elemix's template prop typechecker. Scans a project's
//! `tpl` templates, resolves each `<tag>` back to its `#component` class, and
//! type-checks every `:prop=${expr}` against that class's prop type by deferring
//! the one un-native step — type judgment — to the project's `tsc`. See
//! ANALYZER.md for the design.

mod analyze;
mod imports;
mod lsp;
mod oracle;
mod project;
mod report;

use clap::Parser;
use oracle::TscOracle;
use project::Skipped;
use report::Palette;
use std::collections::HashMap;
use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

#[derive(Parser)]
#[command(
    name = "elemix-analyzer",
    about = "Template prop typechecker for Elemix."
)]
struct Cli {
    /// Directories or globs to scan for `.ts` sources (recursive for a dir).
    #[arg(long = "dirs", value_name = "DIR|GLOB", num_args = 1.., required_unless_present = "lsp")]
    dirs: Vec<String>,

    /// Project root holding `node_modules` + `tsconfig.json` (where `tsc` resolves).
    #[arg(long, default_value = ".")]
    root: String,

    /// Run as a persistent LSP server on stdio (warm state, push diagnostics)
    /// instead of the one-shot CLI report. Same binary, same checks.
    #[arg(long)]
    lsp: bool,

    /// Accepted for LSP-client compatibility - `vscode-languageclient` appends
    /// `--stdio` when it launches the server. The server always talks stdio, so
    /// this is simply tolerated and ignored.
    #[arg(long, hide = true)]
    stdio: bool,

    /// Emit findings as a JSON array (one-shot, for CI) instead of the human report.
    #[arg(long)]
    json: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    // The persistent LSP server owns its own file set (the editor pushes edits),
    // so it takes over before any --dirs scan.
    if cli.lsp || cli.stdio {
        return lsp::serve(&cli.root);
    }

    let root = match std::fs::canonicalize(&cli.root) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("elemix-analyzer: bad --root `{}`: {e}", cli.root);
            return ExitCode::from(2);
        }
    };

    // Read every source once, keyed by its canonical path (so registry lookups
    // and the tsc overlay paths agree).
    let mut files: Vec<(PathBuf, String)> = Vec::new();
    for path in collect_files(&cli.dirs) {
        let Ok(canon) = std::fs::canonicalize(&path) else {
            continue;
        };
        if let Ok(src) = std::fs::read_to_string(&canon) {
            files.push((canon, src));
        }
    }
    if files.is_empty() {
        eprintln!("elemix-analyzer: no .ts files matched {:?}", cli.dirs);
        return ExitCode::from(2);
    }

    let analysis = match analyze::analyze(&root, &files, &TscOracle, false) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("elemix-analyzer: {e}");
            return ExitCode::from(2);
        }
    };

    // Colour the human report when stdout is a real terminal (and NO_COLOR unset).
    let palette =
        Palette::new(std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none());

    // Source lookup for rendering carets against the ORIGINAL files.
    let sources: HashMap<String, String> = files
        .iter()
        .map(|(p, s)| (p.to_string_lossy().into_owned(), s.clone()))
        .collect();
    let source_of = |f: &str| sources.get(f).cloned();

    if cli.json {
        println!("{}", report::render_json(&analysis.findings, source_of));
        return ExitCode::SUCCESS;
    }

    print!("{}", report::banner(&palette));
    print!(
        "{}",
        report::render_pretty(&analysis.findings, source_of, &palette)
    );
    print!(
        "{}",
        report::summary(&analysis.findings, &analysis.stats, &palette)
    );
    report_skipped(&analysis.skipped);

    // Errors fail the build; warnings (e.g. an invalid tag) do not.
    if analysis.findings.iter().any(|f| f.category != "warning") {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}

fn report_skipped(skipped: &[Skipped]) {
    for s in skipped {
        eprintln!("note: skipped <{}> - {}", s.tag, s.reason);
    }
}

/// Expand directories/globs into a sorted, de-duplicated list of `.ts` files.
fn collect_files(patterns: &[String]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for pattern in patterns {
        let glob_pattern = if Path::new(pattern).is_dir() {
            format!("{}/**/*.ts", pattern.trim_end_matches('/'))
        } else {
            pattern.clone()
        };
        let Ok(entries) = glob::glob(&glob_pattern) else {
            continue;
        };
        for entry in entries.flatten() {
            if entry.extension().is_some_and(|e| e == "ts") {
                files.push(entry);
            }
        }
    }
    files.sort();
    files.dedup();
    files
}
