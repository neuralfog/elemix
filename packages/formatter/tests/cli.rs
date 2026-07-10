//! End-to-end: drive the built `elemix-template-formatter` binary. The real
//! formatting pipeline is not wired yet (identity stub), so these lock the CLI
//! shell - banner, summary, file discovery, and exit codes - which the packaging
//! and release wiring depend on staying stable.

use std::process::Command;

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_elemix-template-formatter")
}

/// A fixture with no template, so it is always a fixed point - the shell test can
/// assert a clean run. (The other fixtures are messy inputs for the snapshots.)
fn clean_fixture() -> String {
    format!(
        "{}/tests/fixtures/no-template.ts",
        env!("CARGO_MANIFEST_DIR")
    )
}

fn run(args: &[&str]) -> (String, Option<i32>) {
    let out = Command::new(bin()).args(args).output().unwrap();
    (
        String::from_utf8_lossy(&out.stdout).into_owned(),
        out.status.code(),
    )
}

#[test]
fn requires_dirs() {
    let out = Command::new(bin()).output().unwrap();
    assert_eq!(
        out.status.code(),
        Some(2),
        "missing --dirs is a usage error"
    );
}

#[test]
fn errors_when_no_files_match() {
    let (_, code) = run(&["--dirs", "tests/fixtures/does-not-exist"]);
    assert_eq!(code, Some(2));
}

#[test]
fn stdin_formats_silently() {
    use std::io::Write;
    use std::process::Stdio;

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
        .write_all(b"class C {\n    t = () => tpl`<div>   <span>x</span>   </div>`;\n}\n")
        .unwrap();
    let out = child.wait_with_output().unwrap();
    let stdout = String::from_utf8_lossy(&out.stdout);

    // Silent: no banner, no summary - just the formatted source.
    assert!(!stdout.contains("elemix ·"), "no banner: {stdout}");
    assert!(!stdout.contains("formatted"), "no summary: {stdout}");
    assert!(
        stdout.contains("<span>x</span>"),
        "formatted output: {stdout}"
    );
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn lsp_emits_diagnostics_json() {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new(bin())
        .arg("--lsp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"class C {\n    t = () => tpl`<div>   <span>x</span>   </div>`;\n}\n")
        .unwrap();
    let out = child.wait_with_output().unwrap();
    let stdout = String::from_utf8_lossy(&out.stdout);

    // Pure JSON on stdout: no banner, and it parses as a diagnostic array.
    assert!(!stdout.contains("elemix ·"), "no banner: {stdout}");
    let json: serde_json::Value = serde_json::from_str(stdout.trim()).expect("valid JSON");
    let diags = json.as_array().expect("array");
    assert_eq!(diags.len(), 1, "one unformatted template: {stdout}");
    assert_eq!(diags[0]["severity"], "warning");
    assert_eq!(diags[0]["source"], "etf");
    assert!(
        diags[0]["edit"]
            .as_str()
            .unwrap()
            .contains("<span>x</span>"),
        "fix edit present: {stdout}"
    );
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn lsp_is_empty_for_a_formatted_file() {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new(bin())
        .arg("--lsp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    // Already formatted (no template at all) -> no diagnostics.
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"const x = 1;\n")
        .unwrap();
    let out = child.wait_with_output().unwrap();
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(stdout.trim(), "[]");
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn demo_reports_success_without_writing() {
    use std::fs;

    // A messy fixture that WOULD reformat. `--demo` must show the fix-mode success
    // view and exit 0, yet leave the file byte-for-byte untouched.
    let fixture = format!("{}/tests/fixtures/basic.ts", env!("CARGO_MANIFEST_DIR"));
    let before = fs::read(&fixture).unwrap();

    let (stdout, code) = run(&["--dirs", &fixture, "--demo"]);

    assert!(stdout.contains("formatted"), "success verdict: {stdout}");
    assert!(
        !stdout.contains("needs formatting"),
        "not the lint verdict: {stdout}"
    );
    assert_eq!(code, Some(0), "clean exit");
    assert_eq!(
        fs::read(&fixture).unwrap(),
        before,
        "--demo must not write to disk"
    );
}

#[test]
fn prints_the_shared_shell() {
    let (stdout, code) = run(&["--dirs", &clean_fixture()]);

    // banner
    assert!(stdout.contains("elemix"), "banner wordmark: {stdout}");
    assert!(
        stdout.contains("template-formatter"),
        "banner tool word: {stdout}"
    );
    // summary dashboard
    assert!(stdout.contains("all formatted"), "verdict: {stdout}");
    assert!(stdout.contains("template"), "◆ chip: {stdout}");
    assert!(stdout.contains("file"), "▣ chip: {stdout}");
    // an already-formatted fixture is a fixed point -> clean exit
    assert_eq!(code, Some(0));
}
