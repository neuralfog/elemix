use crate::lower::{apply_edits, trailing_newline};
use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, ModuleExportName, Statement};
use oxc_parser::Parser;
use oxc_span::SourceType;

const RUNTIME: &str = "@neuralfog/elemix/runtime";
const SSR_RUNTIME: &str = "@neuralfog/elemix/ssr-runtime";
const SSR_RUNTIME_CLIENT: &str = "@neuralfog/elemix/ssr-runtime/client";

fn add_runtime_import(code: &str, ids: &[&str], module: &str) -> String {
    let used: Vec<&str> = ids.iter().copied().filter(|id| code.contains(id)).collect();
    if used.is_empty() {
        return code.to_string();
    }
    format!("import {{ {} }} from '{module}';\n{code}", used.join(", "))
}

pub fn add_ssr_runtime_import(code: &str) -> String {
    add_runtime_import(
        code,
        &[
            "$__ssrText",
            "$__ssrAttr",
            "$__ssrClass",
            "$__ssrStyle",
            "$__ssrChild",
            "$__ssrLen",
            "$__ssrTpl",
            "$__ssrRepeat",
            "$__ssrWhen",
            "$__ssrChoose",
            "$__ssrMatch",
            "$__moduleState",
            "$__store",
        ],
        SSR_RUNTIME,
    )
}

pub fn add_hydrate_runtime_import(code: &str) -> String {
    add_runtime_import(
        code,
        &[
            "$__dynLens",
            "$__splitRun",
            "$__bounds",
            "$__span",
            "$__reanchor",
            "$__seat",
            "$__resume",
            "$__fresh",
            "$__text",
        ],
        SSR_RUNTIME_CLIENT,
    )
}

pub fn merge_runtime_imports(source: &str) -> String {
    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, source, SourceType::ts()).parse();

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

    apply_edits(source, edits)
}
