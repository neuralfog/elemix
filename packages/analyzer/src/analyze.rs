use crate::imports;
use crate::oracle::{OracleError, Overlay, TypeOracle};
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
    pub props: HashMap<String, Vec<PropInfo>>,
    pub components: HashMap<String, PathBuf>,
    pub component_classes: HashMap<String, String>,
}

pub fn analyze(
    root: &Path,
    files: &[(PathBuf, String)],
    oracle: &dyn TypeOracle,
    want_props: bool,
) -> Result<Analysis, OracleError> {
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

    for (path, src) in files {
        let file = path.to_string_lossy();
        findings.extend(report::hint_findings(&file, scan_hints(src)));
        findings.extend(report::duplicate_prop_findings(&file, src, &registry));
    }
    findings.extend(imports::unimported_warnings(files, &registry, root));

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
        let raw = oracle.check(&root.to_string_lossy(), &request)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::oracle::RawDiagnostic;
    use std::cell::RefCell;

    struct FakeOracle<F: Fn(&[Overlay]) -> Vec<RawDiagnostic>> {
        seen: RefCell<Vec<String>>,
        emit: F,
    }

    impl<F: Fn(&[Overlay]) -> Vec<RawDiagnostic>> TypeOracle for FakeOracle<F> {
        fn check(
            &self,
            _root: &str,
            overlays: &[Overlay],
        ) -> Result<Vec<RawDiagnostic>, OracleError> {
            self.seen
                .borrow_mut()
                .extend(overlays.iter().map(|o| o.content.clone()));
            Ok((self.emit)(overlays))
        }
    }

    fn project() -> Vec<(PathBuf, String)> {
        vec![
            (
                PathBuf::from("/p/foo.ts"),
                "import { Component, tpl } from '@neuralfog/elemix';\ntype Props = { n: number };\n// #component #tag foo-el\nexport class FooEl extends Component<Props> {\n    template = () => tpl`<div>${this.props.n}</div>`;\n}\n".to_string(),
            ),
            (
                PathBuf::from("/p/app.ts"),
                "import { Component, tpl } from '@neuralfog/elemix';\nimport './foo';\n// #component #tag foo-app\nexport class FooApp extends Component {\n    template = () => tpl`<foo-el :n=${'bad'}></foo-el>`;\n}\n".to_string(),
            ),
        ]
    }

    #[test]
    fn analyze_runs_hermetically_and_builds_prop_checks() {
        let oracle = FakeOracle {
            seen: RefCell::new(Vec::new()),
            emit: |_| Vec::new(),
        };
        let files = project();
        analyze(Path::new("/p"), &files, &oracle, false).unwrap();
        let seen = oracle.seen.borrow();
        assert!(
            seen.iter().any(|c| c.contains("__ck<")),
            "overlay should wrap the :n prop hole: {seen:?}"
        );
    }

    #[test]
    fn a_fake_type_error_maps_back_to_a_prop_finding() {
        let oracle = FakeOracle {
            seen: RefCell::new(Vec::new()),
            emit: |overlays: &[Overlay]| {
                for o in overlays {
                    if let Some(pos) = o.content.find("__ck<__ec") {
                        return vec![RawDiagnostic {
                            file: o.path.clone(),
                            start: pos as u32,
                            code: 2344,
                            category: "error".to_string(),
                            message: "type mismatch".to_string(),
                        }];
                    }
                }
                Vec::new()
            },
        };
        let files = project();
        let analysis = analyze(Path::new("/p"), &files, &oracle, false).unwrap();
        assert!(
            analysis
                .findings
                .iter()
                .any(|f| f.message.contains("has no prop 'n'")),
            "{:?}",
            analysis
                .findings
                .iter()
                .map(|f| &f.message)
                .collect::<Vec<_>>()
        );
    }

    proptest::proptest! {
        #![proptest_config(proptest::prelude::ProptestConfig { cases: 2048, ..proptest::prelude::ProptestConfig::default() })]

        #[test]
        fn analyze_never_panics_on_arbitrary_sources(a in ".{0,400}", b in ".{0,400}") {
            let oracle = FakeOracle {
                seen: RefCell::new(Vec::new()),
                emit: |_| Vec::new(),
            };
            let files = vec![
                (PathBuf::from("/p/a.ts"), a),
                (PathBuf::from("/p/b.ts"), b),
            ];
            let _ = analyze(Path::new("/p"), &files, &oracle, false);
        }
    }
}
