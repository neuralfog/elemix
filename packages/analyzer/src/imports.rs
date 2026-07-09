//! Unimported-component detection. A custom element only registers when its
//! module is loaded (the `#component` `defineComponent` runs as a side effect of
//! import), so using `<user-card>` without importing its module silently renders
//! nothing. This builds the project's import graph and warns at each usage whose
//! component module is not reachable from the using file.

use crate::project::Registry;
use crate::report::{Finding, Subject};
use elemix_compiler::{scan_element_uses, scan_imports};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};

/// A WARNING per template usage of a known component whose module the using file
/// can't reach by import. A warning (not an error): the module could still be
/// loaded by the entry point, so this flags a fragile reliance, not a hard break.
pub fn unimported_warnings(
    files: &[(PathBuf, String)],
    reg: &Registry,
    root: &Path,
) -> Vec<Finding> {
    let in_project: HashSet<PathBuf> = files.iter().map(|(p, _)| p.clone()).collect();

    // tsconfig `paths` aliases (e.g. `#src/*` -> `./src/*`), so an aliased import
    // resolves the same as a relative one and doesn't read as a missing module.
    let aliases = read_alias_rules(root);

    // Per file: the project modules it imports (resolved) + every name it imports.
    let mut edges: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();
    let mut names: HashMap<PathBuf, HashSet<String>> = HashMap::new();
    for (path, src) in files {
        let mut deps = Vec::new();
        let mut idents = HashSet::new();
        for imp in scan_imports(src) {
            idents.extend(imp.names);
            let target = resolve_relative(path, &imp.specifier, &in_project)
                .or_else(|| resolve_alias(&imp.specifier, &aliases, &in_project));
            if let Some(target) = target {
                deps.push(target);
            }
        }
        edges.insert(path.clone(), deps);
        names.insert(path.clone(), idents);
    }

    let mut out = Vec::new();
    for (path, src) in files {
        let reachable = reachable_from(path, &edges);
        let imported = &names[path];
        for usage in scan_element_uses(src) {
            // Only KNOWN project components — native/external tags are out of scope.
            let Some(component) = reg.get(&usage.tag) else {
                continue;
            };
            // Declared here, reachable by import, or the class is imported by name
            // (covers barrels / path aliases the relative resolver can't follow).
            if component.file == *path
                || reachable.contains(&component.file)
                || imported.contains(&component.class)
            {
                continue;
            }
            out.push(Finding {
                file: path.to_string_lossy().into_owned(),
                orig_start: usage.tag_start as usize,
                orig_end: usage.tag_end as usize,
                badge: "import".to_string(),
                category: "warning".to_string(),
                message: format!(
                    "`<{}>` is used but its module is not imported here — a custom \
                     element only registers when its module loads",
                    usage.tag
                ),
                subject: Subject::Component { tag: usage.tag },
            });
        }
    }
    out
}

/// Resolve a relative `import`/`export … from` specifier to a project file: try
/// `spec.ts`, `spec/index.ts`, then `spec` verbatim. `None` for bare/aliased
/// specifiers (not project-relative) or targets outside the scanned set.
fn resolve_relative(from: &Path, spec: &str, in_project: &HashSet<PathBuf>) -> Option<PathBuf> {
    if !spec.starts_with('.') {
        return None;
    }
    let base = from.parent()?;
    for candidate in [
        format!("{spec}.ts"),
        format!("{spec}/index.ts"),
        spec.to_string(),
    ] {
        if let Ok(canon) = std::fs::canonicalize(base.join(&candidate)) {
            if in_project.contains(&canon) {
                return Some(canon);
            }
        }
    }
    None
}

/// A single tsconfig `paths` entry, pre-resolved to absolute target directories:
/// `"#src/*": ["./src/*"]` becomes prefix `#src/` + one target dir `<root>/src`.
struct AliasRule {
    prefix: String,
    has_star: bool,
    targets: Vec<PathBuf>,
}

/// Read `compilerOptions.paths` (and `baseUrl`) from `<root>/tsconfig.json` and
/// pre-resolve each entry to absolute target directories. Tolerant: a missing or
/// unparsable tsconfig, or an absent `paths`, just yields no aliases.
fn read_alias_rules(root: &Path) -> Vec<AliasRule> {
    let Ok(raw) = std::fs::read_to_string(root.join("tsconfig.json")) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&strip_jsonc(&raw)) else {
        return Vec::new();
    };
    let opts = &json["compilerOptions"];
    let base = match opts["baseUrl"].as_str() {
        Some(b) => root.join(b),
        None => root.to_path_buf(),
    };
    let Some(paths) = opts["paths"].as_object() else {
        return Vec::new();
    };

    let mut rules = Vec::new();
    for (key, targets) in paths {
        // Only end-`*` (or exact) keys — the common, well-defined shape.
        let (prefix, has_star) = match key.strip_suffix('*') {
            Some(p) => (p.to_string(), true),
            None => (key.clone(), false),
        };
        let dirs: Vec<PathBuf> = targets
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|t| t.as_str())
            .map(|t| {
                let t = t.strip_suffix('*').unwrap_or(t);
                let t = t.strip_prefix("./").unwrap_or(t);
                base.join(t)
            })
            .collect();
        if !dirs.is_empty() {
            rules.push(AliasRule {
                prefix,
                has_star,
                targets: dirs,
            });
        }
    }
    rules
}

/// Resolve a tsconfig-`paths`-aliased specifier (e.g. `#src/components/Card`) to a
/// project file, mirroring `resolve_relative`'s `.ts`/`/index.ts`/verbatim probe.
fn resolve_alias(
    spec: &str,
    aliases: &[AliasRule],
    in_project: &HashSet<PathBuf>,
) -> Option<PathBuf> {
    for rule in aliases {
        let tail = if rule.has_star {
            spec.strip_prefix(&rule.prefix)?
        } else if spec == rule.prefix {
            ""
        } else {
            continue;
        };
        for dir in &rule.targets {
            let joined = if tail.is_empty() {
                dir.clone()
            } else {
                dir.join(tail)
            };
            let joined = joined.to_string_lossy();
            for candidate in [
                format!("{joined}.ts"),
                format!("{joined}/index.ts"),
                joined.to_string(),
            ] {
                if let Ok(canon) = std::fs::canonicalize(&candidate) {
                    if in_project.contains(&canon) {
                        return Some(canon);
                    }
                }
            }
        }
    }
    None
}

/// Strip `//` line and `/* */` block comments from JSONC (tsconfig), leaving the
/// contents of string literals untouched, so `serde_json` can parse it.
fn strip_jsonc(src: &str) -> String {
    let b = src.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'"' => {
                out.push(b'"');
                i += 1;
                while i < b.len() {
                    if b[i] == b'\\' && i + 1 < b.len() {
                        out.push(b[i]);
                        out.push(b[i + 1]);
                        i += 2;
                        continue;
                    }
                    let c = b[i];
                    out.push(c);
                    i += 1;
                    if c == b'"' {
                        break;
                    }
                }
            }
            b'/' if i + 1 < b.len() && b[i + 1] == b'/' => {
                i += 2;
                while i < b.len() && b[i] != b'\n' {
                    i += 1;
                }
            }
            b'/' if i + 1 < b.len() && b[i + 1] == b'*' => {
                i += 2;
                while i + 1 < b.len() && !(b[i] == b'*' && b[i + 1] == b'/') {
                    i += 1;
                }
                i += 2;
            }
            _ => {
                out.push(b[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Every project module reachable from `start` by following imports transitively.
fn reachable_from(start: &Path, edges: &HashMap<PathBuf, Vec<PathBuf>>) -> HashSet<PathBuf> {
    let mut seen = HashSet::new();
    let mut queue = VecDeque::new();
    queue.push_back(start.to_path_buf());
    while let Some(file) = queue.pop_front() {
        for dep in edges.get(&file).into_iter().flatten() {
            if seen.insert(dep.clone()) {
                queue.push_back(dep.clone());
            }
        }
    }
    seen
}
