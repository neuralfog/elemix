use elemix_template_formatter::{format_source, Options};

fn opts() -> Options {
    Options {
        width: 80,
        tab_width: 4,
        ..Options::default()
    }
}

fn count_holes(s: &str) -> usize {
    s.matches("${").count()
}

#[test]
fn fixtures() {
    insta::glob!("fixtures/*.ts", |path| {
        let src = std::fs::read_to_string(path).unwrap();
        let first = format_source(&src, &opts());

        let second = format_source(&first.output, &opts());
        assert_eq!(
            first.output,
            second.output,
            "not idempotent: {}",
            path.display()
        );
        assert!(
            !second.changed,
            "second pass still reports changes: {}",
            path.display()
        );

        assert_eq!(
            count_holes(&src),
            count_holes(&first.output),
            "hole count changed: {}",
            path.display()
        );

        insta::assert_snapshot!(first.output);
    });
}
