//! End-to-end: run the built `elemix-analyzer` over the fixture project and
//! assert it flags EXACTLY the two bad prop holes (and nothing else). Exercises
//! the whole pipeline — scan → overlay codegen → tsc oracle → span attribution.
//!
//! Needs node + the project's `typescript` (present after `pnpm install`), which
//! is exactly what the analyzer requires to run at all.

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
    // literal hole: number → string
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'number'")),
        "missing the literal name mismatch: {messages:?}"
    );
    // literal hole: string → number
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'count' of <user-card>") && m.contains("'string'")),
        "missing the count mismatch: {messages:?}"
    );
    // STATE-sourced hole: this.state.enabled (boolean) → string, checked in scope
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'boolean'")),
        "missing the state-sourced mismatch: {messages:?}"
    );
    // ENUM-typed prop: a bare string isn't assignable to the nominal enum type.
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'status' of <enum-card>") && m.contains("'Status'")),
        "missing the enum mismatch: {messages:?}"
    );
    // SPECIAL bindings, each against its runtime contract:
    // @event — a non-function, AND a handler typed for the WRONG event (a
    // KeyboardEvent handler on `@click`, which the DOM maps to a PointerEvent).
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
    // UNKNOWN prop name (typo) — the silent custom-element failure mode
    assert!(
        messages.iter().any(|m| m.contains("has no prop 'naem'")),
        "missing the unknown-prop diagnostic: {messages:?}"
    );
    // MALFORMED compiler hint — a typo'd directive, checked without tsc
    assert!(
        messages
            .iter()
            .any(|m| m.contains("unknown pragma directive `#componnt`")),
        "missing the compiler-hint diagnostic: {messages:?}"
    );
    // MODULE-level `#state` store must be an object, not a bare primitive
    assert!(
        messages
            .iter()
            .any(|m| m.contains("module-level `#state` must be an object")),
        "missing the module-state diagnostic: {messages:?}"
    );
    // LIFECYCLE/effect hint on a non-function field → error (only methods or
    // arrow-function fields are valid hook targets).
    assert!(
        messages
            .iter()
            .any(|m| m.contains("must tag a method or an arrow function")),
        "missing the lifecycle-hook diagnostic: {messages:?}"
    );
    // `#state` on a function OR a method → error (state tags reactive data).
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
    // REQUIRED prop omitted → error; the optional one omitted stays clean. Both a
    // partial usage and a zero-prop usage flag the missing `title` (exhaustive).
    let missing_title = messages
        .iter()
        .filter(|m| m.contains("missing required prop: title"))
        .count();
    assert_eq!(
        missing_title, 2,
        "expected the partial AND zero-prop usages to flag missing title: {messages:?}"
    );
    // INVALID custom-element tags → ERRORs (a tag that throws at registration is
    // broken), one per distinct failure mode — exhaustive tag-validator coverage.
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

    // An unimported component → WARNING (severity 2); custom elements only
    // register when their module loads.
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
        // badge: a `TS####` code for any tsc-judged binding, `hint` for compiler
        // hints, `tag` for invalid tags, `import` for the unimported warning.
        let code = d["code"].as_str().unwrap_or("");
        assert!(
            code.starts_with("TS") || matches!(code, "hint" | "tag" | "import"),
            "unexpected diagnostic code: {d}"
        );
        // Errors are severity 1, the import warning is 2.
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

    // Exactly the four bad `match(...)` holes — the two exhaustive fixtures
    // (MatchOk, MatchEnumOk incl. a numeric enum) must stay clean.
    assert_eq!(items.len(), 4, "expected exactly 4 findings, got: {stdout}");

    let messages: Vec<&str> = items
        .iter()
        .map(|d| d["message"].as_str().unwrap())
        .collect();

    // Non-exhaustive: a union member left unhandled.
    assert!(
        messages
            .iter()
            .any(|m| m.contains("non-exhaustive match - missing case") && m.contains("failed")),
        "missing the non-exhaustive diagnostic: {messages:?}"
    );
    // Unknown/typo case — tsc's excess-property error, passed through.
    assert!(
        messages
            .iter()
            .any(|m| m.contains("'c'") && m.contains("does not exist")),
        "missing the excess-case diagnostic: {messages:?}"
    );
    // Typed-value-only: a widened `string` value is rejected.
    assert!(
        messages
            .iter()
            .any(|m| m.contains("match() needs a finite value")),
        "missing the widened-value diagnostic: {messages:?}"
    );
    // Per-branch narrowing: the arm param is narrowed, so a bad member read errors.
    assert!(
        messages
            .iter()
            .any(|m| m.contains("'nope'") && m.contains("k: \"busy\"")),
        "missing the narrowing diagnostic: {messages:?}"
    );

    // Every match finding is a tsc-judged error attributed to the match hole.
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
    // `al-widget` is imported through the `#al/*` tsconfig alias, `al-orphan`
    // is not imported at all. The alias must resolve like a relative import, so
    // ONLY `al-orphan` earns the unimported-module warning.
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
    // A free-standing `tpl` (a module-level `render` export, NOT a component's
    // `template` member) binds props/model/event against MODULE scope. The
    // analyzer must type-check those holes exactly like a component template:
    // flag the two bad props and leave the model/event/store reads alone.
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
    // number → string, in module scope (no `this`)
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'name' of <user-card>") && m.contains("'number'")),
        "missing the free-template name mismatch: {messages:?}"
    );
    // string → number, in module scope
    assert!(
        messages
            .iter()
            .any(|m| m.contains("prop 'count' of <user-card>") && m.contains("'string'")),
        "missing the free-template count mismatch: {messages:?}"
    );
}
