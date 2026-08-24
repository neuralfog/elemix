use elemix_compiler::{
    scan_components, scan_element_uses, scan_match_sites, scan_props, scan_special_bindings,
    SpecialKind,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

pub struct Component {
    pub class: String,
    pub file: PathBuf,
    pub exported: bool,
}

pub type Registry = HashMap<String, Component>;

pub fn build_registry(files: &[(PathBuf, String)]) -> Registry {
    let mut reg = Registry::new();
    for (path, src) in files {
        for decl in scan_components(src) {
            reg.entry(decl.tag).or_insert(Component {
                class: decl.class,
                file: path.clone(),
                exported: decl.exported,
            });
        }
    }
    reg
}

#[derive(Clone, Debug, PartialEq)]
pub struct PropInfo {
    pub name: String,
    pub optional: bool,
}

pub struct MetaProbe {
    pub tag: String,
    pub all_start: usize,
    pub all_end: usize,
    pub req_start: usize,
    pub req_end: usize,
}

pub struct MetaOverlay {
    pub path: PathBuf,
    pub content: String,
    pub probes: Vec<MetaProbe>,
}

pub fn build_metadata_overlay(reg: &Registry, root: &Path) -> Option<MetaOverlay> {
    let mut comps: Vec<(&String, &Component)> = reg.iter().filter(|(_, c)| c.exported).collect();
    if comps.is_empty() {
        return None;
    }
    comps.sort_by(|a, b| a.0.cmp(b.0));

    let path = root.join("__elemix_props__.ts");
    let mut content = String::from(
        "declare function __all<C extends { props: Record<string, unknown> }>(p: Required<C['props']>): void;\n\
         declare function __req<C extends { props: Record<string, unknown> }>(p: C['props']): void;\n",
    );
    for (i, (_, c)) in comps.iter().enumerate() {
        let module = rel_module(&path, &c.file);
        content.push_str(&format!(
            "import {{ {} as __ec{i} }} from '{module}';\n",
            c.class
        ));
    }

    let mut probes = Vec::new();
    for (i, (tag, _)) in comps.iter().enumerate() {
        content.push_str(&format!("function __enum{i}() {{ "));
        let all_start = content.len();
        content.push_str(&format!("__all<__ec{i}>({{}});"));
        let all_end = content.len();
        content.push(' ');
        let req_start = content.len();
        content.push_str(&format!("__req<__ec{i}>({{}});"));
        let req_end = content.len();
        content.push_str(" }\n");
        probes.push(MetaProbe {
            tag: (*tag).clone(),
            all_start,
            all_end,
            req_start,
            req_end,
        });
    }

    Some(MetaOverlay {
        path,
        content,
        probes,
    })
}

#[derive(Clone)]
pub enum BindKind {
    Prop(String),
    Event(String),
    Ref,
    Model,
    OnModel,
    Match,
}

pub struct HoleMap {
    pub wrap_start: usize,
    pub wrap_end: usize,
    pub orig_start: usize,
    pub orig_end: usize,
    pub tag: String,
    pub kind: BindKind,
}

pub struct ElementMap {
    pub check_start: usize,
    pub check_end: usize,
    pub tag: String,
    pub tag_orig_start: usize,
    pub tag_orig_end: usize,
}

pub struct FileOverlay {
    pub path: PathBuf,
    pub content: String,
    pub holes: Vec<HoleMap>,
    pub elements: Vec<ElementMap>,
}

struct ElementInfo {
    provided: Vec<String>,
    tag: String,
    class_ref: String,
    tag_orig_start: usize,
    tag_orig_end: usize,
    import: Option<(String, String, String)>,
}

pub struct Skipped {
    pub tag: String,
    pub reason: String,
}

struct Resolved {
    orig_start: usize,
    orig_end: usize,
    tag: String,
    prop: String,
    class_ref: String,
    import: Option<(String, String, String)>,
}

struct ToWrap {
    orig_start: usize,
    orig_end: usize,
    open: String,
    tag: String,
    kind: BindKind,
}

pub fn build_overlay(
    path: &Path,
    src: &str,
    reg: &Registry,
    skipped: &mut Vec<Skipped>,
) -> Option<FileOverlay> {
    let holes = collect_holes(src, reg, path, skipped);
    let elements_info = collect_elements(src, reg, path);
    let specials = scan_special_bindings(src);
    let match_sites = scan_match_sites(src);

    if holes.is_empty() && elements_info.is_empty() && specials.is_empty() && match_sites.is_empty()
    {
        return None;
    }

    let imports = build_imports(&holes, &elements_info);

    let helper = "declare function __ck<C extends { props: Record<string, unknown> }, K extends keyof C['props']>(v: C['props'][K]): void;\n\
                  declare function __props<C extends { props: Record<string, unknown> }>(p: C['props']): void;\n\
                  declare function __event<K extends string>(name: K, h: (ev: K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event) => void): void;\n\
                  declare function __ref(r: { value: unknown }): void;\n\
                  declare function __model(m: { value: string }): void;\n\
                  declare function __onmodel(t: (value: string) => string): void;\n";

    let mut wraps: Vec<ToWrap> = Vec::new();
    for h in holes {
        let open = format!("__ck<{}, '{}'>(", h.class_ref, h.prop);
        wraps.push(ToWrap {
            orig_start: h.orig_start,
            orig_end: h.orig_end,
            open,
            tag: h.tag,
            kind: BindKind::Prop(h.prop),
        });
    }
    for s in specials {
        let (open, kind) = match s.kind {
            SpecialKind::Event => {
                let name = s.name.unwrap_or_default();
                (format!("__event('{name}', "), BindKind::Event(name))
            }
            SpecialKind::Ref => ("__ref(".to_string(), BindKind::Ref),
            SpecialKind::Model => ("__model(".to_string(), BindKind::Model),
            SpecialKind::OnModel => ("__onmodel(".to_string(), BindKind::OnModel),
        };
        wraps.push(ToWrap {
            orig_start: s.start as usize,
            orig_end: s.end as usize,
            open,
            tag: s.tag,
            kind,
        });
    }
    wraps.sort_by_key(|w| w.orig_start);

    let mut content = String::new();
    content.push_str(&imports);
    content.push_str(helper);
    let mut cursor = 0usize;
    let mut maps = Vec::new();
    for w in &wraps {
        content.push_str(&src[cursor..w.orig_start]);
        let wrap_start = content.len();
        content.push_str(&w.open);
        content.push_str(&src[w.orig_start..w.orig_end]);
        content.push(')');
        let wrap_end = content.len();
        cursor = w.orig_end;
        maps.push(HoleMap {
            wrap_start,
            wrap_end,
            orig_start: w.orig_start,
            orig_end: w.orig_end,
            tag: w.tag.clone(),
            kind: w.kind.clone(),
        });
    }
    content.push_str(&src[cursor..]);

    let prefix_len = imports.len() + helper.len();
    let overlay_of = |orig: usize| -> usize {
        let inserted: usize = wraps
            .iter()
            .map(|w| {
                if w.orig_end <= orig {
                    w.open.len() + 1
                } else if w.orig_start < orig {
                    w.open.len()
                } else {
                    0
                }
            })
            .sum();
        prefix_len + orig + inserted
    };
    for m in &match_sites {
        maps.push(HoleMap {
            wrap_start: overlay_of(m.start as usize),
            wrap_end: overlay_of(m.end as usize),
            orig_start: m.start as usize,
            orig_end: m.end as usize,
            tag: String::new(),
            kind: BindKind::Match,
        });
    }

    content.push('\n');
    let elements = append_element_checks(&mut content, &elements_info);

    Some(FileOverlay {
        path: path.to_path_buf(),
        content,
        holes: maps,
        elements,
    })
}

fn collect_holes(
    src: &str,
    reg: &Registry,
    path: &Path,
    skipped: &mut Vec<Skipped>,
) -> Vec<Resolved> {
    let mut holes = Vec::new();
    for site in scan_props(src) {
        match reg.get(&site.tag) {
            None => continue,
            Some(c) if !c.exported => skipped.push(Skipped {
                tag: site.tag.clone(),
                reason: format!(
                    "class `{}` is not exported, can't be imported to check",
                    c.class
                ),
            }),
            Some(c) => {
                let (class_ref, import) = class_ref_and_import(c, path);
                holes.push(Resolved {
                    orig_start: site.start as usize,
                    orig_end: site.end as usize,
                    tag: site.tag,
                    prop: site.prop,
                    class_ref,
                    import,
                });
            }
        }
    }
    holes
}

fn collect_elements(src: &str, reg: &Registry, path: &Path) -> Vec<ElementInfo> {
    let mut elements_info = Vec::new();
    for e in scan_element_uses(src) {
        if let Some(c) = reg.get(&e.tag) {
            if c.exported {
                let (class_ref, import) = class_ref_and_import(c, path);
                elements_info.push(ElementInfo {
                    provided: e.provided,
                    tag: e.tag,
                    class_ref,
                    tag_orig_start: e.tag_start as usize,
                    tag_orig_end: e.tag_end as usize,
                    import,
                });
            }
        }
    }
    elements_info
}

fn build_imports(holes: &[Resolved], elements: &[ElementInfo]) -> String {
    let mut imports = String::new();
    let mut seen = HashSet::new();
    let mut add_import = |imports: &mut String, imp: &Option<(String, String, String)>| {
        if let Some((alias, class, module)) = imp {
            if seen.insert(alias.clone()) {
                imports.push_str(&format!(
                    "import type {{ {class} as {alias} }} from '{module}';\n"
                ));
            }
        }
    };
    for h in holes {
        add_import(&mut imports, &h.import);
    }
    for e in elements {
        add_import(&mut imports, &e.import);
    }
    imports
}

fn append_element_checks(content: &mut String, elements_info: &[ElementInfo]) -> Vec<ElementMap> {
    let mut elements = Vec::new();
    for (n, e) in elements_info.iter().enumerate() {
        let literal = e
            .provided
            .iter()
            .map(|k| format!("'{k}': (0 as never)"))
            .collect::<Vec<_>>()
            .join(", ");
        content.push_str(&format!("function __req{n}(){{ "));
        let check_start = content.len();
        content.push_str(&format!("__props<{}>({{ {literal} }});", e.class_ref));
        let check_end = content.len();
        content.push_str(" }\n");
        elements.push(ElementMap {
            check_start,
            check_end,
            tag: e.tag.clone(),
            tag_orig_start: e.tag_orig_start,
            tag_orig_end: e.tag_orig_end,
        });
    }
    elements
}

fn class_ref_and_import(c: &Component, path: &Path) -> (String, Option<(String, String, String)>) {
    if c.file == path {
        (c.class.clone(), None)
    } else {
        let alias = format!("__ec_{}", c.class);
        let module = rel_module(path, &c.file);
        (alias.clone(), Some((alias, c.class.clone(), module)))
    }
}

pub(crate) fn rel_module(from_file: &Path, to_file: &Path) -> String {
    let from_dir = from_file.parent().unwrap_or_else(|| Path::new(""));
    let to_no_ext = to_file.with_extension("");
    let rel = diff_paths(from_dir, &to_no_ext);
    let mut s = rel.to_string_lossy().replace('\\', "/");
    if !s.starts_with('.') {
        s = format!("./{s}");
    }
    s
}

fn diff_paths(base: &Path, target: &Path) -> PathBuf {
    let mut b = base.components().peekable();
    let mut t = target.components().peekable();
    while let (Some(x), Some(y)) = (b.peek(), t.peek()) {
        if x != y {
            break;
        }
        b.next();
        t.next();
    }
    let mut res = PathBuf::new();
    for _ in b {
        res.push("..");
    }
    for c in t {
        res.push(c.as_os_str());
    }
    res
}
