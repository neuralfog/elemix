use elemix_compiler::compile;

#[test]
fn fixtures_compile_to_their_snapshots() {
    insta::glob!("../fixtures", "*.ts", |path| {
        let source = std::fs::read_to_string(path).expect("read fixture");
        insta::assert_snapshot!(compile(&source));
    });
}
