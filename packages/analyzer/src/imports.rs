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
pub fn unimported_warnings(files: &[(PathBuf, String)], reg: &Registry) -> Vec<Finding> {
    let in_project: HashSet<PathBuf> = files.iter().map(|(p, _)| p.clone()).collect();

    // Per file: the project modules it imports (resolved) + every name it imports.
    let mut edges: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();
    let mut names: HashMap<PathBuf, HashSet<String>> = HashMap::new();
    for (path, src) in files {
        let mut deps = Vec::new();
        let mut idents = HashSet::new();
        for imp in scan_imports(src) {
            idents.extend(imp.names);
            if let Some(target) = resolve_relative(path, &imp.specifier, &in_project) {
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
