//! `ec-analyzer` (`ea`) — elemix's template prop typechecker. Scans a project's
//! `tpl` templates, resolves each `<tag>` back to its `#component` class, and
//! type-checks every `:prop=${expr}` against that class's prop type by deferring
//! the one un-native step — type judgment — to the project's `tsc`. See
//! ANALYZER.md for the design.

mod imports;
mod oracle;
mod project;
mod report;

use clap::Parser;
use elemix_compiler::scan_hints;
use oracle::{Overlay, TscOracle, TypeOracle};
use project::{build_overlay, build_registry, FileOverlay, Skipped};
use report::{Palette, Stats};
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
    #[arg(long = "dirs", value_name = "DIR|GLOB", num_args = 1.., required = true)]
    dirs: Vec<String>,

    /// Project root holding `node_modules` + `tsconfig.json` (where `tsc` resolves).
    #[arg(long, default_value = ".")]
    root: String,

    /// Emit LSP-shaped JSON diagnostics instead of the human caret report.
    #[arg(long)]
    lsp: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

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

    let registry = build_registry(&files);

    // Build the virtual overlays (wrapped prop holes) for every file that has any.
    let mut overlays: Vec<FileOverlay> = Vec::new();
    let mut skipped: Vec<Skipped> = Vec::new();
    for (path, src) in &files {
        if let Some(ov) = build_overlay(path, src, &registry, &mut skipped) {
            overlays.push(ov);
        }
    }

    let stats = Stats {
        components: registry.len(),
        checked: overlays.iter().map(|o| o.holes.len()).sum(),
        files: files.len(),
    };

    // Colour the human report when stdout is a real terminal (and NO_COLOR unset).
    let palette =
        Palette::new(std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none());

    let mut findings = Vec::new();

    // Compiler-hint checks are pure-Rust (no oracle) — run them on every file.
    for (path, src) in &files {
        findings.extend(report::hint_findings(
            &path.to_string_lossy(),
            scan_hints(src),
        ));
    }

    // Unimported-component warnings — also pure-Rust (an import-graph walk).
    findings.extend(imports::unimported_warnings(&files, &registry, &root));

    // Prop type-judgment is delegated to the project's tsc via the oracle — only
    // needed when there are prop holes to check (hint-only projects skip node).
    if !overlays.is_empty() {
        let request: Vec<Overlay> = overlays
            .iter()
            .map(|o| Overlay {
                path: o.path.to_string_lossy().into_owned(),
                content: o.content.clone(),
            })
            .collect();
        let check: Vec<String> = request.iter().map(|o| o.path.clone()).collect();

        match TscOracle.check(&root.to_string_lossy(), &request, &check) {
            Ok(raw) => findings.extend(report::attribute(&raw, &overlays)),
            Err(e) => {
                eprintln!("elemix-analyzer: {e}");
                return ExitCode::from(2);
            }
        }
    }

    // Stable order: by file, then position in the file.
    findings.sort_by(|a, b| (a.file.as_str(), a.orig_start).cmp(&(b.file.as_str(), b.orig_start)));

    // Source lookup for rendering carets against the ORIGINAL files.
    let sources: HashMap<String, String> = files
        .iter()
        .map(|(p, s)| (p.to_string_lossy().into_owned(), s.clone()))
        .collect();
    let source_of = |f: &str| sources.get(f).cloned();

    if cli.lsp {
        println!("{}", report::render_lsp(&findings, source_of));
        return ExitCode::SUCCESS;
    }

    print!("{}", report::banner(&palette));
    print!("{}", report::render_pretty(&findings, source_of, &palette));
    print!("{}", report::summary(&findings, &stats, &palette));
    report_skipped(&skipped);

    // Errors fail the build; warnings (e.g. an invalid tag) do not.
    if findings.iter().any(|f| f.category != "warning") {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}

fn report_skipped(skipped: &[Skipped]) {
    for s in skipped {
        eprintln!("note: skipped <{}> — {}", s.tag, s.reason);
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
