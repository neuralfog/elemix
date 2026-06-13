//! Snapshot the compiled output of every fixture — a regression lock on the
//! emitted code (what lands in `.emited` and ships to consumers). Runs in
//! `cargo test`, before the Storybook conformance tests.
//!
//! When a codegen change is intentional, re-bless the snapshots with
//! `INSTA_UPDATE=always cargo test --test snapshots` (or `cargo insta review`).

use elemix_compiler::compile;

#[test]
fn fixtures_compile_to_their_snapshots() {
    insta::glob!("fixtures/*.ts", |path| {
        let source = std::fs::read_to_string(path).expect("read fixture");
        insta::assert_snapshot!(compile(&source));
    });
}
