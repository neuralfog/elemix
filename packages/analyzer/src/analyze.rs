//! The shared analysis pipeline - scan -> registry -> overlays -> oracle ->
//! findings. Both the CLI report and the LSP server drive this, so the two paths
//! can never diverge on what counts as a problem.

use crate::imports;
use crate::oracle::{Overlay, TypeOracle};
use crate::project::{
    build_metadata_overlay, build_overlay, build_registry, FileOverlay, PropInfo, Skipped,
};
use crate::report::{self, Finding, Stats};
use elemix_compiler::scan_hints;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct Analysis {
    pub findings: Vec<Finding>,
    pub skipped: Vec<Skipped>,
    pub stats: Stats,
    /// tag → props, for autocomplete. Empty unless `want_props` was set.
    pub props: HashMap<String, Vec<PropInfo>>,
    /// tag → the file declaring the component, for the auto-import code action.
    pub components: HashMap<String, PathBuf>,
    /// tag → the component's class name, for the hover props-type lookup.
    pub component_classes: HashMap<String, String>,
}

/// Run the full analysis over an in-memory file set. `oracle` supplies the one
/// non-native step - type judgment - via the project's tsc. Findings come back
/// sorted by file then position. `want_props` also enumerates every component's
/// props (an extra probe file for the LSP; the CLI leaves it off).
pub fn analyze(
    root: &Path,
    files: &[(PathBuf, String)],
    oracle: &dyn TypeOracle,
    want_props: bool,
) -> Result<Analysis, String> {
    let registry = build_registry(files);
    let components: HashMap<String, PathBuf> = registry
        .iter()
        .map(|(tag, c)| (tag.clone(), c.file.clone()))
        .collect();
    let component_classes: HashMap<String, String> = registry
        .iter()
        .map(|(tag, c)| (tag.clone(), c.class.clone()))
        .collect();

    let mut overlays: Vec<FileOverlay> = Vec::new();
    let mut skipped: Vec<Skipped> = Vec::new();
    for (path, src) in files {
        if let Some(ov) = build_overlay(path, src, &registry, &mut skipped) {
            overlays.push(ov);
        }
    }

    let stats = Stats {
        components: registry.len(),
        checked: overlays.iter().map(|o| o.holes.len()).sum(),
        files: files.len(),
    };

    let mut findings = Vec::new();

    // Pure-Rust checks (no oracle): compiler-hint problems, duplicate props, and
    // unimported components.
    for (path, src) in files {
        let file = path.to_string_lossy();
        findings.extend(report::hint_findings(&file, scan_hints(src)));
        findings.extend(report::duplicate_prop_findings(&file, src, &registry));
    }
    findings.extend(imports::unimported_warnings(files, &registry, root));

    // Prop type judgment (and, for the LSP, prop enumeration) is delegated to the
    // oracle. Build the request from every file overlay, plus one metadata overlay
    // that enumerates every component's props.
    let meta = if want_props {
        build_metadata_overlay(&registry, root)
    } else {
        None
    };
    let mut request: Vec<Overlay> = overlays
        .iter()
        .map(|o| Overlay {
            path: o.path.to_string_lossy().into_owned(),
            content: o.content.clone(),
        })
        .collect();
    if let Some(m) = &meta {
        request.push(Overlay {
            path: m.path.to_string_lossy().into_owned(),
            content: m.content.clone(),
        });
    }

    let mut props = HashMap::new();
    if !request.is_empty() {
        let check: Vec<String> = request.iter().map(|o| o.path.clone()).collect();
        let raw = oracle.check(&root.to_string_lossy(), &request, &check)?;
        findings.extend(report::attribute(&raw, &overlays));
        if let Some(m) = &meta {
            props = report::attribute_metadata(&raw, m);
        }
    }

    findings.sort_by(|a, b| (a.file.as_str(), a.orig_start).cmp(&(b.file.as_str(), b.orig_start)));

    Ok(Analysis {
        findings,
        skipped,
        stats,
        props,
        components,
        component_classes,
    })
}
