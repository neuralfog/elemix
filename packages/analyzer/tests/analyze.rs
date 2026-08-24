use std::process::Command;

fn fixtures() -> String {
    format!("{}/tests/fixtures", env!("CARGO_MANIFEST_DIR"))
}

fn fixtures_match() -> String {
    format!("{}/tests/fixtures-match", env!("CARGO_MANIFEST_DIR"))
}

fn fixtures_alias() -> String {
    format!("{}/tests/fixtures-alias", env!("CARGO_MANIFEST_DIR"))
}

fn fixtures_free() -> String {
    format!("{}/tests/fixtures-free", env!("CARGO_MANIFEST_DIR"))
}

fn run(args: &[&str]) -> (String, Option<i32>) {
    let out = Command::new(env!("CARGO_BIN_EXE_elemix-analyzer"))
        .args(args)
        .output()
        .expect("run elemix-analyzer");
    (
        String::from_utf8_lossy(&out.stdout).into_owned(),
        out.status.code(),
    )
}

#[test]
fn flags_exactly_the_bad_prop_holes() {
    let fx = fixtures();
    let (stdout, _) = run(&["--dirs", &fx, "--root", &fx, "--json"]);

    let value: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("expected JSON, got {stdout:?}: {e}"));
    let items = value.as_array().expect("a JSON array");

    assert_eq!(
        items.len(),
        23,
        "expected exactly 23 findings, got: {stdout}"
    );

    let messages: Vec<&str> = items
        .iter()
        .map(|d| d["message"].as_str().unwrap())
        .collect();
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'number'")),
        "missing the literal name mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'count' of <user-card>") && m.contains("'string'")),
        "missing the count mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'boolean'")),
        "missing the state-sourced mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'status' of <enum-card>") && m.contains("'Status'")),
        "missing the enum mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("@click on <div>") && m.contains("'number'")),
        "missing the @event non-function mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("@click on <div>") && m.contains("KeyboardEvent")),
        "missing the @event wrong-event-type mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains(":ref on <div>") && m.contains("{ value: unknown")),
        "missing the :ref mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("~model on <input>") && m.contains("'string'")),
        "missing the ~model mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("~onmodel on <input>") && m.contains("(value: string) => string")),
        "missing the ~onmodel mismatch: {messages:?}"
    );
    assert!(
        messages.iter().any(|m| m.contains("has no prop 'naem'")),
        "missing the unknown-prop diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("unknown compiler hint `#componnt`")),
        "missing the compiler-hint diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("module-level `#state` must be an object")),
        "missing the module-state diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("must tag a method or an arrow function")),
        "missing the lifecycle-hook diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("must tag a data field, not a function")),
        "missing the state-on-function diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("must tag a data field, not a method")),
        "missing the state-on-method diagnostic: {messages:?}"
    );
    let missing_title = messages
        .iter()
        .filter(|m| m.contains("missing required prop: title"))
        .count();
    assert_eq!(
        missing_title, 2,
        "expected the partial AND zero-prop usages to flag missing title: {messages:?}"
    );
    let has = |needle: &str| messages.iter().any(|m| m.contains(needle));
    assert!(
        has("must contain a hyphen"),
        "missing no-hyphen tag warning: {messages:?}"
    );
    assert!(
        has("must not contain uppercase"),
        "missing uppercase tag warning: {messages:?}"
    );
    assert!(
        has("reserved by SVG/MathML"),
        "missing reserved tag warning: {messages:?}"
    );
    assert!(
        has("must start with a lowercase"),
        "missing digit-start tag warning: {messages:?}"
    );
    assert!(
        has("invalid character"),
        "missing invalid-character tag warning: {messages:?}"
    );

    assert!(
        messages
            .iter()
            .any(|m| m.contains("is used but its module is not imported")),
        "missing the unimported-component warning: {messages:?}"
    );
    let warnings = items
        .iter()
        .filter(|d| d["severity"].as_u64() == Some(2))
        .count();
    assert_eq!(warnings, 1, "expected exactly one warning, got {warnings}");

    for d in items {
        let code = d["code"].as_str().unwrap_or("");
        assert!(
            code.starts_with("TS") || matches!(code, "hint" | "tag" | "import"),
            "unexpected diagnostic code: {d}"
        );
        let sev = d["severity"].as_u64();
        assert!(sev == Some(1) || sev == Some(2), "unexpected severity: {d}");
        assert_eq!(d["source"].as_str(), Some("elemix-analyzer"));
    }
}

#[test]
fn flags_match_directive_problems() {
    let fx = fixtures_match();
    let (stdout, _) = run(&["--dirs", &fx, "--root", &fx, "--json"]);

    let value: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("expected JSON, got {stdout:?}: {e}"));
    let items = value.as_array().expect("a JSON array");

    assert_eq!(items.len(), 4, "expected exactly 4 findings, got: {stdout}");

    let messages: Vec<&str> = items
        .iter()
        .map(|d| d["message"].as_str().unwrap())
        .collect();

    assert!(
        messages
            .iter()
            .any(|m| m.contains("non-exhaustive match - missing case") && m.contains("failed")),
        "missing the non-exhaustive diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("'c'") && m.contains("does not exist")),
        "missing the excess-case diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("match() needs a finite value")),
        "missing the widened-value diagnostic: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("'nope'") && m.contains("k: \"busy\"")),
        "missing the narrowing diagnostic: {messages:?}"
    );

    for d in items {
        assert_eq!(
            d["severity"].as_u64(),
            Some(1),
            "match findings are errors: {d}"
        );
        assert!(
            d["code"].as_str().unwrap_or("").starts_with("TS"),
            "match findings carry a TS code: {d}"
        );
    }
}

#[test]
fn pretty_mode_exits_nonzero_when_errors_found() {
    let fx = fixtures();
    let (_, code) = run(&["--dirs", &fx, "--root", &fx]);
    assert_eq!(code, Some(1), "errors must fail the process for CI");
}

#[test]
fn tsconfig_path_alias_resolves_a_side_effect_import() {
    let fx = fixtures_alias();
    let (stdout, _) = run(&["--dirs", &fx, "--root", &fx, "--json"]);

    assert!(
        stdout.contains("is used but its module is not imported"),
        "expected an unimported warning: {stdout}"
    );
    assert!(
        stdout.contains("al-orphan"),
        "al-orphan (never imported) must warn: {stdout}"
    );
    assert!(
        !stdout.contains("al-widget"),
        "al-widget is imported via the #al/* alias and must NOT warn: {stdout}"
    );
}

#[test]
fn checks_prop_holes_in_a_free_standing_template() {
    let fx = fixtures_free();
    let (stdout, _) = run(&["--dirs", &fx, "--root", &fx, "--json"]);

    let value: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("expected JSON, got {stdout:?}: {e}"));
    let items = value.as_array().expect("a JSON array");

    assert_eq!(items.len(), 2, "expected exactly 2 findings, got: {stdout}");

    let messages: Vec<&str> = items
        .iter()
        .map(|d| d["message"].as_str().unwrap())
        .collect();
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'number'")),
        "missing the free-template name mismatch: {messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'count' of <user-card>") && m.contains("'string'")),
        "missing the free-template count mismatch: {messages:?}"
    );
}
