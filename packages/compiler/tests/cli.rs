//! CLI integration tests — drive the real `elemix-compiler` binary against the
//! fixtures. Cargo builds the bin and hands us its path via `CARGO_BIN_EXE_*`.

use std::path::PathBuf;
use std::process::Command;

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_elemix-compiler")
}

/// A fresh, empty output directory under the system temp dir.
fn out_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ec-cli-{name}"));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

#[test]
fn errors_with_exit_2_when_no_input() {
    let out = Command::new(bin()).output().unwrap();
    assert_eq!(out.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&out.stderr).contains("--file"));
}

#[test]
fn file_without_out_prints_a_summary() {
    let out = Command::new(bin())
        .args(["--file", "tests/fixtures/CounterApp.ts"])
        .output()
        .unwrap();
    assert!(out.status.success());
    assert!(String::from_utf8_lossy(&out.stdout).contains("template(s)"));
}

#[test]
fn compiles_a_single_file_to_the_out_dir() {
    let dir = out_dir("single");
    let status = Command::new(bin())
        .args(["--file", "tests/fixtures/CounterApp.ts", "--out"])
        .arg(&dir)
        .status()
        .unwrap();
    assert!(status.success());

    let compiled = std::fs::read_to_string(dir.join("CounterApp.ts")).unwrap();
    assert!(compiled.contains("view(): DocumentFragment"));
    assert!(compiled.contains("from '@neuralfog/elemix/runtime'"));
    assert!(compiled.contains("const _t0 = template("));
    // the html intrinsic and the directive are fully lowered/erased
    assert!(!compiled.contains("tpl`"));
    assert!(!compiled.contains("repeat("));
}

#[test]
fn stdin_mode_pipes_compiled_source_to_stdout() {
    use std::io::Write;
    use std::process::Stdio;

    let source = std::fs::read_to_string("tests/fixtures/CounterApp.ts").unwrap();
    let mut child = Command::new(bin())
        .arg("--stdin")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(source.as_bytes())
        .unwrap();
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success());

    let compiled = String::from_utf8(out.stdout).unwrap();
    assert!(compiled.contains("view(): DocumentFragment"));
    assert!(compiled.contains("from '@neuralfog/elemix/runtime'"));
    assert!(!compiled.contains("tpl`"));
}

#[test]
fn banner_shows_the_package_json_version_on_stderr() {
    // the version baked into the banner must match package.json (not Cargo.toml)
    let pkg = std::fs::read_to_string("package.json").unwrap();
    let key = "\"version\"";
    let after = &pkg[pkg.find(key).unwrap() + key.len()..];
    let open = after.find('"').unwrap() + 1;
    let version = &after[open..open + after[open..].find('"').unwrap()];

    let out = Command::new(bin())
        .args(["--file", "tests/fixtures/CounterApp.ts"])
        .output()
        .unwrap();
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("elemix"));
    assert!(stderr.contains("template compiler"));
    assert!(stderr.contains(version), "banner missing version {version}");
}

#[test]
fn stdin_mode_emits_no_banner() {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new(bin())
        .arg("--stdin")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"const x = 1;")
        .unwrap();
    let out = child.wait_with_output().unwrap();
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        !stderr.contains("template compiler"),
        "banner leaked into pipe mode"
    );
}

#[test]
fn stdin_sourcemap_emits_a_code_map_envelope() {
    use std::io::Write;
    use std::process::Stdio;

    let source = std::fs::read_to_string("tests/fixtures/CounterApp.ts").unwrap();
    let mut child = Command::new(bin())
        .args(["--stdin", "--sourcemap"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(source.as_bytes())
        .unwrap();
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success());

    // stdout is a JSON envelope, not raw code: it carries both code and a v3 map
    let envelope = String::from_utf8(out.stdout).unwrap();
    assert!(envelope.starts_with("{\"code\":"));
    assert!(envelope.contains("\"map\":{\"version\":3"));
    assert!(envelope.contains("view(): DocumentFragment"));
}

#[test]
fn compiles_a_single_file_with_a_sidecar_map() {
    let dir = out_dir("map");
    let status = Command::new(bin())
        .args([
            "--file",
            "tests/fixtures/CounterApp.ts",
            "--sourcemap",
            "--out",
        ])
        .arg(&dir)
        .status()
        .unwrap();
    assert!(status.success());

    let compiled = std::fs::read_to_string(dir.join("CounterApp.ts")).unwrap();
    assert!(compiled.contains("//# sourceMappingURL=CounterApp.ts.map"));
    let map = std::fs::read_to_string(dir.join("CounterApp.ts.map")).unwrap();
    assert!(map.contains("\"version\":3"));
}

#[test]
fn compiles_a_directory_of_fixtures() {
    let dir = out_dir("dir");
    let status = Command::new(bin())
        .args(["--dirs", "tests/fixtures", "--out"])
        .arg(&dir)
        .status()
        .unwrap();
    assert!(status.success());

    let files: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(Result::ok)
        .collect();
    assert_eq!(files.len(), 56);

    // no compiled file in the whole corpus leaks the html intrinsic or a directive
    for entry in files {
        let src = std::fs::read_to_string(entry.path()).unwrap();
        let name = entry.file_name();
        assert!(!src.contains("tpl`"), "tpl` leaked in {name:?}");
        assert!(!src.contains("repeat("), "repeat( leaked in {name:?}");
    }
}

#[test]
fn tolerant_by_default_emits_an_errored_component_with_an_inlined_throw() {
    let dir = out_dir("tolerant");
    let out = Command::new(bin())
        .args(["--file", "tests/fixtures/ErrorApp.ts", "--out"])
        .arg(&dir)
        .output()
        .unwrap();
    // best-effort: succeeds and writes the file with the error inlined as a throw
    assert!(out.status.success());
    let compiled = std::fs::read_to_string(dir.join("ErrorApp.ts")).unwrap();
    assert!(compiled.starts_with("throw new Error('[elemix] ErrorApp:"));
    // the diagnostic is still reported on stderr
    assert!(String::from_utf8_lossy(&out.stderr).contains("unknown pragma directive"));
}

#[test]
fn strict_fails_and_writes_nothing_on_an_error() {
    let dir = out_dir("strict-err");
    let out = Command::new(bin())
        .args(["--file", "tests/fixtures/ErrorApp.ts", "--strict", "--out"])
        .arg(&dir)
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(1));
    assert!(!dir.join("ErrorApp.ts").exists());
    assert!(String::from_utf8_lossy(&out.stderr).contains("compile failed (strict)"));
}

#[test]
fn strict_passes_a_clean_component() {
    let dir = out_dir("strict-clean");
    let status = Command::new(bin())
        .args([
            "--file",
            "tests/fixtures/CounterApp.ts",
            "--strict",
            "--out",
        ])
        .arg(&dir)
        .status()
        .unwrap();
    assert!(status.success());
    assert!(dir.join("CounterApp.ts").exists());
}

#[test]
fn strict_does_not_fail_on_a_warning() {
    let dir = out_dir("strict-warn");
    let status = Command::new(bin())
        .args(["--file", "tests/fixtures/WarnApp.ts", "--strict", "--out"])
        .arg(&dir)
        .status()
        .unwrap();
    // a warning is not an error — strict still writes it and exits clean
    assert!(status.success());
    let compiled = std::fs::read_to_string(dir.join("WarnApp.ts")).unwrap();
    assert!(compiled.contains("console.warn('[elemix] WarnApp:"));
}
