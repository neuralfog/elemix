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
use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

#[derive(Parser)]
#[command(
    name = "elemix-analyzer",
    about = "Template prop typechecker for Elemix."
)]
struct Cli {
    #[arg(long = "dirs", value_name = "DIR|GLOB", num_args = 1.., required_unless_present = "lsp")]
    dirs: Vec<String>,

    #[arg(long, default_value = ".")]
    root: String,

    #[arg(long)]
    lsp: bool,

    #[arg(long, hide = true)]
    stdio: bool,

    #[arg(long)]
    json: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

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

    let palette =
        Palette::new(std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none());

    let sources = report::source_map(&files);
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

    if analysis.findings.iter().any(|f| !report::is_warning(f)) {
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
