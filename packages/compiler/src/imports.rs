//! Post-pass: fold the compiler's own `@neuralfog/elemix/runtime` imports into
//! one. The pragma and rewrite stages each prepend a `from '.../runtime'` import
//! for the primitives they emit; rather than couple the two passes, this merges
//! whatever they produced. Only the compiler-owned runtime module is collapsed —
//! user imports (which never target `/runtime`) are left untouched.

use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, ModuleExportName, Statement};
use oxc_parser::Parser;
use oxc_span::SourceType;

const RUNTIME: &str = "@neuralfog/elemix/runtime";

/// Merge multiple `import { … } from '@neuralfog/elemix/runtime'` statements
/// into the first, preserving first-seen specifier order. Identity for zero or
/// one such import.
pub fn merge_runtime_imports(source: &str) -> String {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

    // Each runtime import: (span start, span end, named specifiers).
    let mut imports: Vec<(usize, usize, Vec<String>)> = Vec::new();
    for stmt in &ret.program.body {
        let Statement::ImportDeclaration(import) = stmt else {
            continue;
        };
        if import.source.value.as_str() != RUNTIME {
            continue;
        }
        let Some(specifiers) = &import.specifiers else {
            continue;
        };
        let mut names = Vec::new();
        let mut pure = true;
        for spec in specifiers {
            match spec {
                ImportDeclarationSpecifier::ImportSpecifier(s) => names.push(match &s.imported {
                    ModuleExportName::IdentifierName(id) => id.name.to_string(),
                    ModuleExportName::IdentifierReference(id) => id.name.to_string(),
                    ModuleExportName::StringLiteral(s) => s.value.to_string(),
                }),
                // a default or namespace import — leave the statement alone
                _ => {
                    pure = false;
                    break;
                }
            }
        }
        if pure {
            imports.push((import.span.start as usize, import.span.end as usize, names));
        }
    }

    if imports.len() <= 1 {
        return source.to_string();
    }

    // Union of names, first-seen order.
    let mut seen = std::collections::HashSet::new();
    let mut merged = Vec::new();
    for (_, _, names) in &imports {
        for name in names {
            if seen.insert(name.clone()) {
                merged.push(name.clone());
            }
        }
    }

    let mut edits: Vec<(usize, usize, String)> = vec![(
        imports[0].0,
        imports[0].1,
        format!("import {{ {} }} from '{RUNTIME}';", merged.join(", ")),
    )];
    for (start, end, _) in &imports[1..] {
        let end = end + trailing_newline(source, *end);
        edits.push((*start, end, String::new()));
    }

    edits.sort_by_key(|e| std::cmp::Reverse(e.0));
    let mut out = source.to_string();
    for (start, end, repl) in edits {
        out.replace_range(start..end, &repl);
    }
    out
}

fn trailing_newline(source: &str, at: usize) -> usize {
    usize::from(source[at..].starts_with('\n'))
}
