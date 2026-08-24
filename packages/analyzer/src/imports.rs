use crate::project::Registry;
use crate::report::{Finding, Subject};
use elemix_compiler::{scan_element_uses, scan_imports};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};

pub fn unimported_warnings(
    files: &[(PathBuf, String)],
    reg: &Registry,
    root: &Path,
) -> Vec<Finding> {
    let in_project: HashSet<PathBuf> = files.iter().map(|(p, _)| p.clone()).collect();

    let aliases = read_alias_rules(root);

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
            let Some(component) = reg.get(&usage.tag) else {
                continue;
            };
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
                    "`<{}>` is used but its module is not imported here - a custom \
                     element only registers when its module loads",
                    usage.tag
                ),
                subject: Subject::Component { tag: usage.tag },
            });
        }
    }
    out
}

pub(crate) fn import_specifier(component_file: &Path, current_file: &Path, root: &Path) -> String {
    for rule in read_alias_rules(root) {
        for dir in &rule.targets {
            let dir = std::fs::canonicalize(dir).unwrap_or_else(|_| dir.clone());
            let Ok(rel) = component_file.strip_prefix(&dir) else {
                continue;
            };
            let rel = rel.with_extension("");
            let rel = rel.to_string_lossy().replace('\\', "/");
            if rule.has_star {
                return format!("{}{}", rule.prefix, rel);
            }
            if rel.is_empty() {
                return rule.prefix.clone();
            }
        }
    }
    crate::project::rel_module(current_file, component_file)
}

fn first_in_project(stem: &str, in_project: &HashSet<PathBuf>) -> Option<PathBuf> {
    for candidate in [
        format!("{stem}.ts"),
        format!("{stem}/index.ts"),
        stem.to_string(),
    ] {
        if let Ok(canon) = std::fs::canonicalize(&candidate) {
            if in_project.contains(&canon) {
                return Some(canon);
            }
        }
    }
    None
}

fn resolve_relative(from: &Path, spec: &str, in_project: &HashSet<PathBuf>) -> Option<PathBuf> {
    if !spec.starts_with('.') {
        return None;
    }
    let stem = from.parent()?.join(spec);
    first_in_project(&stem.to_string_lossy(), in_project)
}

struct AliasRule {
    prefix: String,
    has_star: bool,
    targets: Vec<PathBuf>,
}

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
            if let Some(hit) = first_in_project(&joined.to_string_lossy(), in_project) {
                return Some(hit);
            }
        }
    }
    None
}

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
