use clap::Parser;
use elemix_template_formatter::report::{Palette, Stats};
use elemix_template_formatter::{format, report};
use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

#[derive(Parser)]
#[command(
    name = "elemix-template-formatter",
    about = "HTML template formatter for Elemix tpl`` literals."
)]
struct Cli {
    #[arg(long = "dirs", value_name = "DIR|GLOB", num_args = 1.., required_unless_present_any = ["stdin", "lsp"])]
    dirs: Vec<String>,

    #[arg(long)]
    stdin: bool,

    #[arg(long)]
    lsp: bool,

    #[arg(long, default_value = ".")]
    root: String,

    #[arg(long)]
    write: bool,

    #[arg(long)]
    check: bool,

    #[arg(long, hide = true)]
    demo: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let write = cli.write && !cli.check;
    let settings = elemix_template_formatter::config::load(&cli.root);
    let opts = &settings.options;

    if cli.stdin {
        let Some(src) = read_stdin() else {
            return ExitCode::from(2);
        };
        let out = if settings.enabled {
            format::format_source(&src, opts).output
        } else {
            src
        };
        print!("{out}");
        return ExitCode::SUCCESS;
    }

    if cli.lsp {
        let Some(src) = read_stdin() else {
            return ExitCode::from(2);
        };
        let diags = if settings.enabled {
            format::diagnose(&src, opts)
        } else {
            Vec::new()
        };
        println!("{}", serde_json::to_string(&diags).unwrap());
        return ExitCode::SUCCESS;
    }

    if !settings.enabled {
        return ExitCode::SUCCESS;
    }

    let palette =
        Palette::new(std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none());

    let files = collect_files(&cli.dirs);
    if files.is_empty() {
        eprintln!(
            "elemix-template-formatter: no .ts/.js files matched {:?}",
            cli.dirs
        );
        return ExitCode::from(2);
    }

    let mut templates = 0;
    let mut changed = 0;
    let mut diffs = String::new();
    let mut had_error = false;

    for path in &files {
        let Ok(src) = std::fs::read_to_string(path) else {
            continue;
        };
        let result = format::format_source(&src, opts);
        templates += result.templates;
        if !result.changed {
            continue;
        }
        changed += 1;
        if cli.demo {
        } else if write {
            if std::fs::write(path, &result.output).is_err() {
                eprintln!(
                    "elemix-template-formatter: could not write {}",
                    path.display()
                );
                had_error = true;
            }
        } else {
            diffs.push_str(&report::diff(
                &path.to_string_lossy(),
                &src,
                &result.output,
                &palette,
            ));
        }
    }

    let stats = Stats {
        templates,
        changed,
        files: files.len(),
    };

    let report_as_fix = write || cli.demo;

    print!("{}", report::banner(&palette));
    print!("{diffs}");
    print!("{}", report::summary(&stats, report_as_fix, &palette));

    if had_error {
        ExitCode::from(2)
    } else if !report_as_fix && changed > 0 {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}

fn read_stdin() -> Option<String> {
    let mut src = String::new();
    if std::io::Read::read_to_string(&mut std::io::stdin(), &mut src).is_err() {
        eprintln!("elemix-template-formatter: failed to read stdin");
        return None;
    }
    Some(src)
}

fn collect_files(patterns: &[String]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for pattern in patterns {
        let glob_pattern = if Path::new(pattern).is_dir() {
            format!("{}/**/*", pattern.trim_end_matches('/'))
        } else {
            pattern.clone()
        };
        let Ok(entries) = glob::glob(&glob_pattern) else {
            continue;
        };
        for entry in entries.flatten() {
            if entry.is_file() && entry.extension().is_some_and(|e| e == "ts" || e == "js") {
                files.push(entry);
            }
        }
    }
    files.sort();
    files.dedup();
    files
}
