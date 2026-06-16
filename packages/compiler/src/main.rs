//! elemix-compiler CLI.

use clap::Parser;
use elemix_compiler::codegen::codegen;
use elemix_compiler::emit::TsEmitter;
use elemix_compiler::{collect_ts_files, compile, find_html_templates, FoundTemplate};
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
}

fn main() {
    let cli = Cli::parse();

    // Pipe mode: source in on stdin, compiled `.ts` out on stdout. Drives the
    // Vite plugin — one compile per module, no temp files. No banner here: this
    // path is hot and machine-driven, stdout is reserved for compiled output.
    if cli.stdin {
        let mut source = String::new();
        io::stdin().read_to_string(&mut source).expect("read stdin");
        io::stdout()
            .write_all(compile(&source).as_bytes())
            .expect("write stdout");
        return;
    }

    banner();

    if cli.dirs.is_empty() && cli.file.is_none() {
        eprintln!("error: pass --file <path>, --dirs <dir|glob>..., or --stdin");
        std::process::exit(2);
    }

    for path in collect_ts_files(&cli.dirs) {
        process(&path, cli.out.as_deref(), false);
    }
    if let Some(path) = cli.file.clone() {
        process(&path, cli.out.as_deref(), true);
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

fn process(path: &Path, out: Option<&Path>, verbose: bool) {
    let source = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error reading {}: {e}", path.display());
            std::process::exit(1);
        }
    };
    match out {
        Some(dir) => emit(dir, path, &compile(&source)),
        None if verbose => print_detail(path, &find_html_templates(&source)),
        None => {
            let n = find_html_templates(&source).len();
            println!("{}: {n} template(s)", path.display());
        }
    }
}

/// Write the compiled source to `<dir>/<filename>`.
fn emit(dir: &Path, src: &Path, compiled: &str) {
    fs::create_dir_all(dir).expect("create out dir");
    let dest = dir.join(src.file_name().expect("source has a file name"));
    fs::write(&dest, compiled).expect("write emitted file");
    println!("emitted {}", dest.display());
}

fn print_detail(path: &Path, templates: &[FoundTemplate]) {
    println!("{} — {} template(s)", path.display(), templates.len());
    let emitter = TsEmitter::new();
    for (i, t) in templates.iter().enumerate() {
        let generated = codegen(&t.statics, &t.holes, &emitter);
        println!("  [{i}] generated:");
        for line in generated.lines() {
            println!("        {line}");
        }
    }
}
