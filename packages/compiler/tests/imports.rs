//! Tests for the runtime-import merge post-pass.

use elemix_compiler::imports::merge_runtime_imports;

const RT: &str = "@neuralfog/elemix/runtime";

#[test]
fn merges_two_runtime_imports() {
    let src = format!(
        "import {{ template, clone }} from '{RT}';\nimport {{ defineComponent, sheet }} from '{RT}';\nclass Foo {{}}"
    );
    let out = merge_runtime_imports(&src);
    assert_eq!(
        out,
        format!(
            "import {{ template, clone, defineComponent, sheet }} from '{RT}';\nclass Foo {{}}"
        )
    );
}

#[test]
fn dedupes_overlapping_names() {
    let src = format!(
        "import {{ sheet, clone }} from '{RT}';\nimport {{ sheet, defineComponent }} from '{RT}';\n"
    );
    let out = merge_runtime_imports(&src);
    assert_eq!(
        out,
        format!("import {{ sheet, clone, defineComponent }} from '{RT}';\n")
    );
}

#[test]
fn single_runtime_import_is_untouched() {
    let src = format!("import {{ template }} from '{RT}';\nclass Foo {{}}");
    assert_eq!(merge_runtime_imports(&src), src);
}

#[test]
fn no_runtime_imports_is_identity() {
    let src = "import { Component } from '@neuralfog/elemix';\nclass Foo {}";
    assert_eq!(merge_runtime_imports(src), src);
}

#[test]
fn leaves_user_imports_alone() {
    // imports from other modules are never merged, even if duplicated.
    let src = format!(
        "import {{ a }} from '@neuralfog/elemix';\nimport {{ template }} from '{RT}';\nimport {{ b }} from '@neuralfog/elemix';\nimport {{ sheet }} from '{RT}';\n"
    );
    let out = merge_runtime_imports(&src);
    assert!(out.contains("import { a } from '@neuralfog/elemix';"));
    assert!(out.contains("import { b } from '@neuralfog/elemix';"));
    assert_eq!(out.matches(RT).count(), 1);
    assert!(out.contains(&format!("import {{ template, sheet }} from '{RT}';")));
}
