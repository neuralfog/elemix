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
    assert_eq!(files.len(), 40);

    // no compiled file in the whole corpus leaks the html intrinsic or a directive
    for entry in files {
        let src = std::fs::read_to_string(entry.path()).unwrap();
        let name = entry.file_name();
        assert!(!src.contains("tpl`"), "tpl` leaked in {name:?}");
        assert!(!src.contains("repeat("), "repeat( leaked in {name:?}");
    }
}
