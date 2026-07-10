//! Exhaustive fixture snapshots. Every `tests/cases/*.ts` is formatted and its
//! output locked with `insta`, so any change in formatting is a visible, reviewed
//! diff. Each case also asserts the two hard guarantees on the spot: the result
//! is idempotent (a fixed point) and every `${…}` hole survives.
//!
//! Update after an intended change: `INSTA_UPDATE=always cargo test --test snapshots`
//! (or `cargo insta review`).

use elemix_template_formatter::{format_source, Options};

fn opts() -> Options {
    Options {
        width: 80,
        tab_width: 4,
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

        // Idempotency: formatting the result again changes nothing.
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

        // Hole preservation: no `${…}` is dropped or duplicated.
        assert_eq!(
            count_holes(&src),
            count_holes(&first.output),
            "hole count changed: {}",
            path.display()
        );

        insta::assert_snapshot!(first.output);
    });
}
