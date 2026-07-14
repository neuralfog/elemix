//! Project model: the tag→component registry and the per-file VIRTUAL overlay
//! that wraps each prop hole in a typed identity call, in scope, plus the map
//! from each wrapped hole back to its original source span.

use elemix_compiler::{
    scan_components, scan_element_uses, scan_match_sites, scan_props, scan_special_bindings,
    SpecialKind,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// A registered component: where its class is declared + whether it's importable.
pub struct Component {
    pub class: String,
    pub file: PathBuf,
    pub exported: bool,
}

/// tag → component, project-wide.
pub type Registry = HashMap<String, Component>;

/// Build the registry from every `#component` declaration across the project.
/// First declaration of a tag wins (a later duplicate is ignored).
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

/// One component prop for autocomplete: its name and whether it's optional.
#[derive(Clone, Debug, PartialEq)]
pub struct PropInfo {
    pub name: String,
    pub optional: bool,
}

/// A per-component enumeration probe in the metadata overlay: the overlay byte
/// ranges whose tsc "missing properties" errors spell out the prop set — the ALL
/// range (an empty object vs `Required<props>`, so optional props count as
/// missing too) and the REQUIRED range (empty object vs `props`).
pub struct MetaProbe {
    pub tag: String,
    pub all_start: usize,
    pub all_end: usize,
    pub req_start: usize,
    pub req_end: usize,
}

/// A synthetic file that imports every exported component and, per component,
/// assigns `{}` to its (Required) prop type — forcing tsc to enumerate the props
/// in a "missing the following properties" error, the SAME diagnostic the
/// required-prop check already parses. This is how tag → props is surfaced.
pub struct MetaOverlay {
    pub path: PathBuf,
    pub content: String,
    pub probes: Vec<MetaProbe>,
}

/// Build the metadata overlay for prop enumeration. `None` when the project has
/// no exported components to probe.
pub fn build_metadata_overlay(reg: &Registry, root: &Path) -> Option<MetaOverlay> {
    let mut comps: Vec<(&String, &Component)> = reg.iter().filter(|(_, c)| c.exported).collect();
    if comps.is_empty() {
        return None;
    }
    // Deterministic order (map iteration is not) so overlays are stable.
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

/// What a wrapped hole binds — drives the diagnostic's subject + message reframe.
#[derive(Clone)]
pub enum BindKind {
    /// `:prop` — carries the prop name (supports the unknown-prop reframe).
    Prop(String),
    /// `@event` — carries the event name.
    Event(String),
    /// `:ref`.
    Ref,
    /// `~model`.
    Model,
    /// `~onmodel`.
    OnModel,
    /// A `match(...)` directive hole — its whole call is type-checked in place,
    /// so no wrapper is inserted; the map just claims tsc's diagnostics for it.
    Match,
}

/// A wrapped hole's overlay range paired with its ORIGINAL source span — what
/// turns a tsc diagnostic (overlay coords) back into a caret on the real hole.
/// The range spans the WHOLE wrapper call, so it also catches the unknown-prop
/// error tsc reports on the `'prop'` type argument (before the call's parens).
pub struct HoleMap {
    pub wrap_start: usize,
    pub wrap_end: usize,
    pub orig_start: usize,
    pub orig_end: usize,
    pub tag: String,
    pub kind: BindKind,
}

/// A per-element completeness check's overlay range, paired with the element's
/// tag ORIGINAL span — so a "missing required prop" error (which has no hole to
/// caret, the prop being absent) lands on the `<tag>` instead.
pub struct ElementMap {
    pub check_start: usize,
    pub check_end: usize,
    pub tag: String,
    pub tag_orig_start: usize,
    pub tag_orig_end: usize,
}

/// A file's virtual overlay: its synthetic content + the hole + element maps.
pub struct FileOverlay {
    pub path: PathBuf,
    pub content: String,
    pub holes: Vec<HoleMap>,
    pub elements: Vec<ElementMap>,
}

/// A checkable element usage: provided props, the component type to check against,
/// its tag's original span (the caret), and any type-only import the check needs.
struct ElementInfo {
    provided: Vec<String>,
    tag: String,
    class_ref: String,
    tag_orig_start: usize,
    tag_orig_end: usize,
    import: Option<(String, String, String)>,
}

/// A prop site that couldn't be checked — surfaced as a note, never an error.
pub struct Skipped {
    pub tag: String,
    pub reason: String,
}

/// A resolved, checkable prop hole (registry lookup succeeded + class importable).
struct Resolved {
    orig_start: usize,
    orig_end: usize,
    tag: String,
    prop: String,
    /// Type reference for the wrapper: the class name (same file) or an alias.
    class_ref: String,
    /// `Some((alias, class, module))` when a type-only import must be injected.
    import: Option<(String, String, String)>,
}

/// A hole rewritten in place as `<open>expr)` — props and special bindings alike.
struct ToWrap {
    orig_start: usize,
    orig_end: usize,
    /// The wrapper opener, e.g. `__ck<UserCard, 'name'>(` or `__event(`.
    open: String,
    tag: String,
    kind: BindKind,
}

/// Build a file's overlay, or `None` if it has no checkable prop holes. Unknown
/// tags (native/external elements) are silently skipped; a known component whose
/// class isn't exported is recorded in `skipped`.
pub fn build_overlay(
    path: &Path,
    src: &str,
    reg: &Registry,
    skipped: &mut Vec<Skipped>,
) -> Option<FileOverlay> {
    let mut holes: Vec<Resolved> = Vec::new();

    for site in scan_props(src) {
        match reg.get(&site.tag) {
            // Not one of our components — a native element or third-party tag.
            None => continue,
            Some(c) if !c.exported => skipped.push(Skipped {
                tag: site.tag.clone(),
                reason: format!(
                    "class `{}` is not exported, can't be imported to check",
                    c.class
                ),
            }),
            Some(c) => {
                let (class_ref, import) = if c.file == path {
                    // Declared in this very file — already in module scope.
                    (c.class.clone(), None)
                } else {
                    let alias = format!("__ec_{}", c.class);
                    let module = rel_module(path, &c.file);
                    (alias.clone(), Some((alias, c.class.clone(), module)))
                };
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

    // Required-prop checks run for every checkable component USAGE (registered +
    // exported), independent of whether it binds any props — a propless usage
    // still needs every required prop flagged. The completeness check references
    // only the component type (not `this`/row scope), so it's injected at MODULE
    // level rather than into the template.
    let mut elements_info: Vec<ElementInfo> = Vec::new();
    for e in scan_element_uses(src) {
        if let Some(c) = reg.get(&e.tag) {
            if c.exported {
                let class_ref = if c.file == path {
                    c.class.clone()
                } else {
                    format!("__ec_{}", c.class)
                };
                elements_info.push(ElementInfo {
                    provided: e.provided,
                    tag: e.tag,
                    class_ref,
                    tag_orig_start: e.tag_start as usize,
                    tag_orig_end: e.tag_end as usize,
                    import: (c.file != path).then(|| {
                        (
                            format!("__ec_{}", c.class),
                            c.class.clone(),
                            rel_module(path, &c.file),
                        )
                    }),
                });
            }
        }
    }

    // Special bindings (`@event`/`:ref`/`~model`/`~onmodel`) — checked on ANY
    // element against a FIXED type, so no registry lookup and no import.
    let specials = scan_special_bindings(src);

    // `match(...)` holes type-check themselves in place (their whole call is a
    // real expression in the verbatim overlay), so they carry no wrapper — only a
    // map claiming tsc's exhaustiveness / narrowing / typed-value diagnostics.
    let match_sites = scan_match_sites(src);

    if holes.is_empty() && elements_info.is_empty() && specials.is_empty() && match_sites.is_empty()
    {
        return None;
    }

    // Prefix: one type-only import per referenced class (from props AND element
    // checks — a zero-prop usage's class has no hole to carry it) + the helpers.
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
    for h in &holes {
        add_import(&mut imports, &h.import);
    }
    for e in &elements_info {
        add_import(&mut imports, &e.import);
    }

    // `__ck` checks one prop's value; `__props` a usage's whole provided set (so a
    // missing REQUIRED prop surfaces — `(0 as never)` neutralises values). The rest
    // type-check the fixed-shape bindings against the runtime primitives' contracts.
    // `__event` keys the handler's event type off the DOM event map, so `@click`
    // wants a `MouseEvent` handler, `@keydown` a `KeyboardEvent`, etc. A custom
    // event name (not in the map) falls back to `Event`, so it never false-flags.
    let helper = "declare function __ck<C extends { props: Record<string, unknown> }, K extends keyof C['props']>(v: C['props'][K]): void;\n\
                  declare function __props<C extends { props: Record<string, unknown> }>(p: C['props']): void;\n\
                  declare function __event<K extends string>(name: K, h: (ev: K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event) => void): void;\n\
                  declare function __ref(r: { value: unknown }): void;\n\
                  declare function __model(m: { value: string }): void;\n\
                  declare function __onmodel(t: (value: string) => string): void;\n";

    // One ordered list of holes to rewrite in place: props as `__ck<…>(expr)`,
    // specials as `__event(expr)` / `__ref(expr)` / `__model(expr)` / `__onmodel(expr)`.
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
            // The event name becomes a string-literal type arg, so the handler is
            // checked against that specific event's type.
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

    // Body: original source verbatim, each hole rewritten in place to its wrapper
    // so tsc checks the expr against the wrapper's parameter type.
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

    // `match(...)` holes aren't wrapped, so map each original span to its overlay
    // position by adding the prefix plus every wrapper insertion that lands before
    // it (a wrapper straddling the point contributes only its opener). The range
    // covers the whole call, so its self-checked diagnostics (missing/typo case,
    // widened value, bad narrowed read) fall inside it - and since attribution
    // picks the innermost hole, nested `:prop` wraps in the arms still win.
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

    // Append one module-level completeness check per checkable usage. Each only
    // names a component type + string-literal keys, so module scope suffices —
    // and a zero-prop usage (no hole) is covered exactly like any other.
    content.push('\n');
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

    Some(FileOverlay {
        path: path.to_path_buf(),
        content,
        holes: maps,
        elements,
    })
}

/// A `./`-prefixed, extension-less module specifier from `from_file`'s directory
/// to `to_file` (forward slashes), for the injected type-only import.
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

/// Relative path from `base` to `target` (both absolute) — `../` for each base
/// segment past the common prefix, then the remainder of `target`.
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
