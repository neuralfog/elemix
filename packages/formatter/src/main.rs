//! `etf` (`elemix-template-formatter`) - format the HTML inside ``tpl`` `` literals.
//!
//! Standalone: no `elemix-compiler` / `elemix-analyzer` dependency. It owns its
//! scanner/parser/printer. Two modes: lint (default, print a diff, exit 1 if any
//! file needs formatting) and `--write` (rewrite in place). See spec.md.

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
    /// Files/dirs/globs to scan for `.ts`/`.js` sources (recursive for a dir).
    #[arg(long = "dirs", value_name = "DIR|GLOB", num_args = 1.., required_unless_present_any = ["stdin", "lsp"])]
    dirs: Vec<String>,

    /// Format source read from stdin and write the result to stdout (no banner or
    /// summary) - for editor format-on-save. Ignores `--dirs`/`--write`.
    #[arg(long)]
    stdin: bool,

    /// With `--stdin`: this is a save-triggered format, so honour the config's
    /// `[formatter] format_on_save`. When it's false, the input passes through
    /// unchanged. Editors send this on save so the on/off lives in `elemix.toml`,
    /// not the editor. An explicit "format now" omits it and always formats.
    #[arg(long = "on-save")]
    on_save: bool,

    /// Read source from stdin and emit formatting diagnostics as JSON to stdout
    /// (LSP-shaped ranges + a fix edit per unformatted template) - for editor
    /// squiggles. Formatting only; correctness is the analyzer's job.
    #[arg(long)]
    lsp: bool,

    /// Project root (for config discovery).
    #[arg(long, default_value = ".")]
    root: String,

    /// Rewrite files in place (the "fix" mode). Default is lint/check.
    #[arg(long)]
    write: bool,

    /// Lint mode (the default): report only.
    #[arg(long)]
    check: bool,

    /// Internal: show the `✓ formatted` success view (as if `--write` ran) but
    /// never touch a file - so a demo folder stays unformatted for the before/after
    /// screenshots. Reports success (exit 0), writes nothing. Not for end users.
    #[arg(long, hide = true)]
    demo: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let write = cli.write && !cli.check;
    // Everything comes solely from `elemix.toml` at (or above) --root - width,
    // indent, and whether the formatter runs at all. A missing/malformed file uses
    // the defaults (enabled, 80/4/space).
    let settings = elemix_template_formatter::config::load(&cli.root);
    let opts = &settings.options;

    // Silent stdin -> stdout, for editors. No banner, no summary; format whatever
    // comes in and hand it straight back (unparseable templates pass through).
    if cli.stdin {
        let Some(src) = read_stdin() else {
            return ExitCode::from(2);
        };
        // Format unless the formatter is off, or this is a save and the config
        // has format_on_save disabled - in either case echo the input unchanged.
        let format = settings.enabled && (!cli.on_save || settings.format_on_save);
        let out = if format {
            format::format_source(&src, opts).output
        } else {
            src
        };
        print!("{out}");
        return ExitCode::SUCCESS;
    }

    // Diagnostics for editors: a JSON array of unformatted-template ranges (+ fix
    // edits) on stdout, empty `[]` when the source is already formatted. Nothing
    // else on stdout so the extension can parse it directly.
    if cli.lsp {
        let Some(src) = read_stdin() else {
            return ExitCode::from(2);
        };
        // Disabled: report no diagnostics (which also means no "Format template"
        // code action, since editors derive it from these).
        let diags = if settings.enabled {
            format::diagnose(&src, opts)
        } else {
            Vec::new()
        };
        println!("{}", serde_json::to_string(&diags).unwrap());
        return ExitCode::SUCCESS;
    }

    // CLI (--dirs): disabled means format nothing at all.
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
            // Report as a successful fix, but write nothing and print no diff -
            // the "after" success view, leaving the demo files untouched.
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

    // Dry-run borrows the fix-mode summary ("✓ formatted N files") and clean exit,
    // without having written anything.
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

/// Read all of stdin, or print an error and return `None` on failure.
fn read_stdin() -> Option<String> {
    let mut src = String::new();
    if std::io::Read::read_to_string(&mut std::io::stdin(), &mut src).is_err() {
        eprintln!("elemix-template-formatter: failed to read stdin");
        return None;
    }
    Some(src)
}

/// Expand dirs/globs into a sorted, de-duplicated list of `.ts`/`.js` files.
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
