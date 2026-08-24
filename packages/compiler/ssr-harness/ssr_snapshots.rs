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
