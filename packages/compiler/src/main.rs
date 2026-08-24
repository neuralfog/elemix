use clap::Parser;
use elemix_compiler::codegen::codegen;
use elemix_compiler::diagnostics::{Diagnostic, Severity};
use elemix_compiler::emit::TsEmitter;
use elemix_compiler::sourcemap::{json_string, line_map};
use elemix_compiler::{
    collect_ts_files, compile_diagnostics_mode, compile_hydrate, compile_ssr, find_html_templates,
    FoundTemplate,
};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "elemix-compiler", about = "Compile elemix templates")]
struct Cli {
    #[arg(long, num_args = 1..)]
    dirs: Vec<String>,

    #[arg(long)]
    file: Option<PathBuf>,

    #[arg(long)]
    out: Option<PathBuf>,

    #[arg(long)]
    stdin: bool,

    #[arg(long)]
    ssr: bool,

    #[arg(long)]
    hydrate: bool,

    #[arg(long)]
    minify: bool,

    #[arg(long)]
    sourcemap: bool,
}

fn main() {
    let cli = Cli::parse();

    if cli.stdin {
        let mut source = String::new();
        io::stdin().read_to_string(&mut source).expect("read stdin");
        let (code, diags) = compile_dispatch(&source, cli.ssr, cli.hydrate, cli.minify);
        report(None, &diags);
        let payload = if cli.sourcemap {
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

    for path in collect_ts_files(&cli.dirs) {
        process(
            &path,
            cli.out.as_deref(),
            cli.sourcemap,
            cli.ssr,
            cli.hydrate,
            cli.minify,
            false,
        );
    }
    if let Some(path) = cli.file.clone() {
        process(
            &path,
            cli.out.as_deref(),
            cli.sourcemap,
            cli.ssr,
            cli.hydrate,
            cli.minify,
            true,
        );
    }
}

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

const VERSION: &str = match option_env!("ELEMIX_VERSION") {
    Some(v) => v,
    None => env!("CARGO_PKG_VERSION"),
};

fn banner() {
    eprintln!();
    eprintln!("  \x1b[35m▐▌\x1b[0m  \x1b[1melemix\x1b[0m \x1b[2m·\x1b[0m template compiler");
    eprintln!("  \x1b[35m▐▌\x1b[0m  \x1b[2mv{VERSION}\x1b[0m");
    eprintln!();
}

fn process(
    path: &Path,
    out: Option<&Path>,
    sourcemap: bool,
    ssr: bool,
    hydrate: bool,
    minify: bool,
    verbose: bool,
) {
    let source = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error reading {}: {e}", path.display());
            std::process::exit(1);
        }
    };
    match out {
        Some(dir) => emit(dir, path, &source, sourcemap, ssr, hydrate, minify),
        None if verbose => print_detail(path, &find_html_templates(&source)),
        None => {
            let n = find_html_templates(&source).len();
            println!("{}: {n} template(s)", path.display());
        }
    }
}

fn compile_dispatch(
    source: &str,
    ssr: bool,
    hydrate: bool,
    minify: bool,
) -> (String, Vec<Diagnostic>) {
    if hydrate {
        compile_hydrate(source, minify)
    } else if ssr {
        compile_ssr(source, minify)
    } else {
        compile_diagnostics_mode(source, false, false, minify)
    }
}

fn emit(
    dir: &Path,
    src: &Path,
    source: &str,
    sourcemap: bool,
    ssr: bool,
    hydrate: bool,
    minify: bool,
) {
    let name = src.file_name().expect("source has a file name");
    let dest = dir.join(name);

    let (code, diags) = compile_dispatch(source, ssr, hydrate, minify);
    report(Some(src), &diags);

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
