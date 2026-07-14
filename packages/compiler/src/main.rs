//! elemix-compiler CLI.

use clap::Parser;
use elemix_compiler::codegen::codegen;
use elemix_compiler::diagnostics::{self, Diagnostic, Severity};
use elemix_compiler::emit::TsEmitter;
use elemix_compiler::sourcemap::{json_string, line_map};
use elemix_compiler::{collect_ts_files, compile_diagnostics, find_html_templates, FoundTemplate};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "elemix-compiler", about = "Compile elemix templates")]
struct Cli {
    /// Directories or globs of `.ts` files to scan.
    #[arg(long, num_args = 1..)]
    dirs: Vec<String>,

    /// A single `.ts` file to process.
    #[arg(long)]
    file: Option<PathBuf>,

    /// Emit compiled files into this directory. When unset, prints instead.
    #[arg(long)]
    out: Option<PathBuf>,

    /// Read source from stdin and write the compiled `.ts` to stdout.
    #[arg(long)]
    stdin: bool,

    /// Also produce a line-level source map back to the original. With `--stdin`
    /// stdout becomes a `{"code","map"}` JSON envelope; with `--out` a sidecar
    /// `<file>.map` is written and the compiled file gets a `sourceMappingURL`.
    #[arg(long)]
    sourcemap: bool,

    /// Fail (non-zero exit, no file written) on an error-level diagnostic.
    /// Off by default: the compiler writes best-effort output with errors
    /// inlined as a runtime `throw` and reports them on stderr.
    #[arg(long)]
    strict: bool,
}

fn main() {
    let cli = Cli::parse();

    // Pipe mode: source in on stdin, compiled `.ts` out on stdout. Drives the
    // Vite plugin — one compile per module, no temp files. No banner here: this
    // path is hot and machine-driven, stdout is reserved for compiled output.
    if cli.stdin {
        let mut source = String::new();
        io::stdin().read_to_string(&mut source).expect("read stdin");
        // Dev path: never fail. Diagnostics are inlined into `code` (so they
        // surface in the browser) and echoed to stderr (so they show in the
        // Vite terminal); the compile always succeeds and HMR stays alive.
        let (code, diags) = compile_diagnostics(&source);
        report(None, &diags);
        let payload = if cli.sourcemap {
            // Machine envelope: the Vite plugin parses this and returns
            // `{ code, map }` so the source-map chain is never severed.
            let map = line_map(&source, &code, "input.ts");
            format!("{{\"code\":{},\"map\":{map}}}", json_string(&code))
        } else {
            code
        };
        io::stdout()
            .write_all(payload.as_bytes())
            .expect("write stdout");
        return;
    }

    banner();

    if cli.dirs.is_empty() && cli.file.is_none() {
        eprintln!("error: pass --file <path>, --dirs <dir|glob>..., or --stdin");
        std::process::exit(2);
    }

    // Build path: a diagnostic error fails the run (non-zero exit, broken file
    // not written) so CI never ships code that throws at runtime.
    let mut ok = true;
    for path in collect_ts_files(&cli.dirs) {
        ok &= process(&path, cli.out.as_deref(), cli.sourcemap, cli.strict, false);
    }
    if let Some(path) = cli.file.clone() {
        ok &= process(&path, cli.out.as_deref(), cli.sourcemap, cli.strict, true);
    }
    if !ok {
        std::process::exit(1);
    }
}

/// Print diagnostics to stderr (never stdout — that's reserved for compiled
/// output / the pipe envelope). Errors red, warnings yellow.
fn report(path: Option<&Path>, diags: &[Diagnostic]) {
    if diags.is_empty() {
        return;
    }
    if let Some(p) = path {
        eprintln!("  \x1b[1m{}\x1b[0m", p.display());
    }
    for d in diags {
        let (label, color) = match d.severity {
            Severity::Error => ("error", "\x1b[31m"),
            Severity::Warning => ("warn ", "\x1b[33m"),
        };
        let who = d
            .component
            .as_deref()
            .map(|c| format!("{c}: "))
            .unwrap_or_default();
        eprintln!("  {color}{label}\x1b[0m  {who}{}", d.message);
    }
}

/// Version embedded at build time, Go-`ldflags` style. The npm `build` script
/// injects the authoritative `package.json` version as `ELEMIX_VERSION`; a bare
/// `cargo build` falls back to the in-sync Cargo.toml version.
const VERSION: &str = match option_env!("ELEMIX_VERSION") {
    Some(v) => v,
    None => env!("CARGO_PKG_VERSION"),
};

/// Branded startup banner, printed to stderr so it never mixes with compiled
/// output or emit messages on stdout. Omitted in `--stdin` (pipe) mode.
fn banner() {
    eprintln!();
    eprintln!("  \x1b[35m▐▌\x1b[0m  \x1b[1melemix\x1b[0m \x1b[2m·\x1b[0m template compiler");
    eprintln!("  \x1b[35m▐▌\x1b[0m  \x1b[2mv{VERSION}\x1b[0m");
    eprintln!();
}

fn process(path: &Path, out: Option<&Path>, sourcemap: bool, strict: bool, verbose: bool) -> bool {
    let source = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error reading {}: {e}", path.display());
            std::process::exit(1);
        }
    };
    match out {
        Some(dir) => emit(dir, path, &source, sourcemap, strict),
        None if verbose => {
            print_detail(path, &find_html_templates(&source));
            true
        }
        None => {
            let n = find_html_templates(&source).len();
            println!("{}: {n} template(s)", path.display());
            true
        }
    }
}

/// Write the compiled source to `<dir>/<filename>`, plus a sidecar `.map` and a
/// `sourceMappingURL` footer when `sourcemap` is set. With `strict`, an error
/// diagnostic writes nothing and returns `false`; otherwise the best-effort
/// output (error inlined as a `throw`) is written and `true` returned.
fn emit(dir: &Path, src: &Path, source: &str, sourcemap: bool, strict: bool) -> bool {
    let name = src.file_name().expect("source has a file name");
    let dest = dir.join(name);

    let (code, diags) = compile_diagnostics(source);
    report(Some(src), &diags);
    if strict && diagnostics::has_errors(&diags) {
        eprintln!(
            "  \x1b[31mcompile failed (strict)\x1b[0m - {} not written",
            dest.display()
        );
        return false;
    }

    fs::create_dir_all(dir).expect("create out dir");
    if sourcemap {
        let map = line_map(source, &code, &name.to_string_lossy());
        let map_name = format!("{}.map", name.to_string_lossy());
        let mut compiled = code;
        compiled.push_str(&format!("\n//# sourceMappingURL={map_name}\n"));
        fs::write(dir.join(&map_name), map).expect("write source map");
        fs::write(&dest, compiled).expect("write emitted file");
    } else {
        fs::write(&dest, code).expect("write emitted file");
    }
    println!("emitted {}", dest.display());
    true
}

fn print_detail(path: &Path, templates: &[FoundTemplate]) {
    println!("{} - {} template(s)", path.display(), templates.len());
    let emitter = TsEmitter::new();
    for (i, t) in templates.iter().enumerate() {
        let generated = codegen(&t.statics, &t.holes, &emitter);
        println!("  [{i}] generated:");
        for line in generated.lines() {
            println!("        {line}");
        }
    }
}
