//! Snapshot the SSR (`--ssr`) and hydration (`--hydrate`) compiled output of
//! EVERY fixture — the server-render + client-hydrate regression lock, mirroring
//! the CSR `tests/snapshots.rs` glob. One snapshot per fixture per direction, so
//! any drift in the emitted `$$__ssr()` / `$$__hydrate()` shows up per file.
//!
//! Re-bless intentional changes with
//! `INSTA_UPDATE=always cargo test --test ssr-snapshots` (or `cargo insta review`).

use elemix_compiler::{compile_hydrate, compile_ssr};

#[test]
fn fixtures_ssr_to_their_snapshots() {
    insta::glob!("../fixtures", "*.ts", |path| {
        let source = std::fs::read_to_string(path).expect("read fixture");
        insta::assert_snapshot!(compile_ssr(&source, false).0);
    });
}

#[test]
fn fixtures_hydrate_to_their_snapshots() {
    insta::glob!("../fixtures", "*.ts", |path| {
        let source = std::fs::read_to_string(path).expect("read fixture");
        insta::assert_snapshot!(compile_hydrate(&source, false).0);
    });
}
