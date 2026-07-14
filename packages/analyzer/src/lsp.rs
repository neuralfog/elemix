//! The persistent LSP server behind `--lsp`. Same binary, same checks as the CLI;
//! it just keeps warm state (the loaded project file set, the editor's dirty
//! buffers) and pushes diagnostics on a debounce instead of running once and
//! exiting. The one slow step, type judgment, is delegated to the project's tsc
//! via the same oracle the CLI uses.

use crate::analyze;
use crate::imports;
use crate::oracle::TscOracle;
use crate::project::PropInfo;
use crate::report::{self, LspFinding};
use lsp_server::Response;
use lsp_server::{Connection, Message, Notification};
use lsp_types::{
    CodeAction, CodeActionKind, CodeActionOrCommand, CodeActionParams,
    CodeActionProviderCapability, CompletionItem, CompletionItemKind, CompletionOptions,
    CompletionParams, CompletionTextEdit, Diagnostic, DiagnosticSeverity, Documentation, Hover,
    HoverContents, HoverParams, HoverProviderCapability, InitializeParams, InsertTextFormat,
    MarkupContent, MarkupKind, NumberOrString, Position, PublishDiagnosticsParams, Range,
    ServerCapabilities, TextDocumentSyncCapability, TextDocumentSyncKind, TextEdit, Uri,
    WorkspaceEdit,
};
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

/// How long the server waits for edits to settle before re-analyzing. Keystrokes
/// coalesce into one tsc run.
const DEBOUNCE: Duration = Duration::from_millis(300);

pub fn serve(root_arg: &str) -> ExitCode {
    match run(root_arg) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("elemix-analyzer lsp: {e}");
            ExitCode::from(2)
        }
    }
}

fn run(root_arg: &str) -> Result<(), Box<dyn Error + Sync + Send>> {
    let (connection, io_threads) = Connection::stdio();

    let capabilities = ServerCapabilities {
        text_document_sync: Some(TextDocumentSyncCapability::Kind(TextDocumentSyncKind::FULL)),
        completion_provider: Some(CompletionOptions {
            // `<` opens a tag, `#` a compiler hint, the binding sigils `:`/`@`/`~`.
            trigger_characters: Some(vec![
                "<".to_string(),
                "#".to_string(),
                ":".to_string(),
                "@".to_string(),
                "~".to_string(),
            ]),
            ..Default::default()
        }),
        // The auto-import quick-fix for an unimported component.
        code_action_provider: Some(CodeActionProviderCapability::Simple(true)),
        // Hover docs for `// #…` compiler hints.
        hover_provider: Some(HoverProviderCapability::Simple(true)),
        ..Default::default()
    };
    let init_value = connection.initialize(serde_json::to_value(capabilities)?)?;
    let init: InitializeParams = serde_json::from_value(init_value)?;

    // Prefer the editor's workspace folder as the project root; fall back to the
    // --root flag the extension passes.
    let root = workspace_root(&init).unwrap_or_else(|| resolve_root(root_arg));

    // Clear any temp sidecars/tsconfig/buildinfo a previously-killed server left
    // behind, so they neither linger nor get read back in as project sources.
    sweep_temp(&root);

    // Keep the message loop in an inner scope so `state` drops before we join the
    // IO threads (which can block until the client closes the pipe).
    {
        let mut state = State::new(root);
        state.load_project();
        state.analyze_and_publish(&connection);

        loop {
            // When there are pending edits, block only for the debounce window so a
            // lull triggers a re-analysis; otherwise block indefinitely for the
            // next message.
            let msg = if state.dirty {
                match connection.receiver.recv_timeout(DEBOUNCE) {
                    Ok(m) => m,
                    Err(e) if e.is_timeout() => {
                        state.analyze_and_publish(&connection);
                        continue;
                    }
                    Err(_) => break,
                }
            } else {
                match connection.receiver.recv() {
                    Ok(m) => m,
                    Err(_) => break,
                }
            };

            match msg {
                Message::Request(req) => {
                    if connection.handle_shutdown(&req)? {
                        break;
                    }
                    if req.method == "textDocument/completion" {
                        let items = serde_json::from_value(req.params)
                            .map(|p| state.complete(&p))
                            .unwrap_or_default();
                        let resp = Response::new_ok(req.id, items);
                        let _ = connection.sender.send(Message::Response(resp));
                    } else if req.method == "textDocument/codeAction" {
                        let actions = serde_json::from_value(req.params)
                            .map(|p| state.code_actions(&p))
                            .unwrap_or_default();
                        let resp = Response::new_ok(req.id, actions);
                        let _ = connection.sender.send(Message::Response(resp));
                    } else if req.method == "textDocument/hover" {
                        let hover = serde_json::from_value(req.params)
                            .ok()
                            .and_then(|p| state.hover(&p));
                        let resp = Response::new_ok(req.id, hover);
                        let _ = connection.sender.send(Message::Response(resp));
                    }
                }
                Message::Notification(not) => state.handle_notification(not),
                Message::Response(_) => {}
            }
        }
    }

    io_threads.join()?;
    Ok(())
}

struct State {
    root: PathBuf,
    /// Every project `.ts` file's on-disk content, loaded once.
    base: HashMap<PathBuf, String>,
    /// The editor's live buffers - these shadow `base` while a file is open.
    open: HashMap<PathBuf, String>,
    /// File paths we last published non-empty diagnostics for, so we can clear the
    /// ones that go clean. Keyed by path string (not `Uri`, which caches state).
    published: HashSet<String>,
    /// tag → props, refreshed each analysis; the source for `:prop` completion.
    props: HashMap<String, Vec<PropInfo>>,
    /// tag → declaring file, refreshed each analysis; for the auto-import quick-fix.
    components: HashMap<String, PathBuf>,
    /// tag → class name, refreshed each analysis; for the hover props-type lookup.
    component_classes: HashMap<String, String>,
    dirty: bool,
}

impl State {
    fn new(root: PathBuf) -> Self {
        State {
            root,
            base: HashMap::new(),
            open: HashMap::new(),
            published: HashSet::new(),
            props: HashMap::new(),
            components: HashMap::new(),
            component_classes: HashMap::new(),
            dirty: false,
        }
    }

    /// Read every project `.ts` file from disk into `base` (skipping the usual
    /// output/dependency dirs).
    fn load_project(&mut self) {
        let pattern = format!("{}/**/*.ts", self.root.to_string_lossy());
        let Ok(entries) = glob::glob(&pattern) else {
            return;
        };
        for entry in entries.flatten() {
            if is_ignored(&entry) || entry.extension().is_none_or(|e| e != "ts") {
                continue;
            }
            let canon = std::fs::canonicalize(&entry).unwrap_or(entry);
            if let Ok(src) = std::fs::read_to_string(&canon) {
                self.base.insert(canon, src);
            }
        }
    }

    fn handle_notification(&mut self, not: Notification) {
        match not.method.as_str() {
            "textDocument/didOpen" => {
                if let Ok(p) =
                    serde_json::from_value::<lsp_types::DidOpenTextDocumentParams>(not.params)
                {
                    if let Some(path) = uri_to_path(&p.text_document.uri) {
                        self.open.insert(path, p.text_document.text);
                        self.dirty = true;
                    }
                }
            }
            "textDocument/didChange" => {
                if let Ok(p) =
                    serde_json::from_value::<lsp_types::DidChangeTextDocumentParams>(not.params)
                {
                    // FULL sync: the last change carries the whole document.
                    if let (Some(path), Some(change)) = (
                        uri_to_path(&p.text_document.uri),
                        p.content_changes.into_iter().last(),
                    ) {
                        self.open.insert(path, change.text);
                        self.dirty = true;
                    }
                }
            }
            "textDocument/didSave" => {
                self.dirty = true;
            }
            "textDocument/didClose" => {
                if let Ok(p) =
                    serde_json::from_value::<lsp_types::DidCloseTextDocumentParams>(not.params)
                {
                    if let Some(path) = uri_to_path(&p.text_document.uri) {
                        self.open.remove(&path);
                        // The buffer is gone; re-read disk so `base` is current.
                        if let Ok(src) = std::fs::read_to_string(&path) {
                            self.base.insert(path, src);
                        }
                        self.dirty = true;
                    }
                }
            }
            _ => {}
        }
    }

    /// Merge disk `base` with the editor's `open` buffers and run the analysis.
    fn snapshot(&self) -> Vec<(PathBuf, String)> {
        let mut merged: HashMap<&PathBuf, &String> = HashMap::new();
        for (p, s) in &self.base {
            merged.insert(p, s);
        }
        for (p, s) in &self.open {
            merged.insert(p, s);
        }
        merged
            .into_iter()
            .map(|(p, s)| (p.clone(), s.clone()))
            .collect()
    }

    /// Answer a completion from the cached tag → props: when the cursor sits in a
    /// `<tag …>` open tag inside a `tpl` template, offer the component's
    /// not-yet-bound props as `:name` items. Pure + synchronous - no tsc.
    fn complete(&self, params: &CompletionParams) -> Vec<CompletionItem> {
        let uri = &params.text_document_position.text_document.uri;
        let Some(path) = uri_to_path(uri) else {
            return Vec::new();
        };
        let Some(text) = self.open.get(&path).or_else(|| self.base.get(&path)) else {
            return Vec::new();
        };
        let pos = params.text_document_position.position;
        let offset = offset_of(text, pos.line, pos.character);

        // Compiler-hint completion on a `// #…` comment line.
        if let Some(token) = pragma_token(line_before_cursor(text, offset)) {
            let back: u32 = token.chars().map(|c| c.len_utf16() as u32).sum();
            let range = Range {
                start: Position {
                    line: pos.line,
                    character: pos.character.saturating_sub(back),
                },
                end: pos,
            };
            return HINTS.iter().map(|h| hint_item(h, range)).collect();
        }

        // Typing the TAG NAME just after `<` → complete registered component tags
        // to a self-closed element (with required-prop holes).
        if let Some(partial) = tag_name_context(text, offset) {
            let back: u32 = partial.chars().map(|c| c.len_utf16() as u32).sum();
            let range = Range {
                start: Position {
                    line: pos.line,
                    character: pos.character.saturating_sub(back),
                },
                end: pos,
            };
            let mut tags: Vec<&String> = self.props.keys().collect();
            tags.sort();
            return tags
                .into_iter()
                .map(|tag| {
                    let required: Vec<&str> = self.props[tag]
                        .iter()
                        .filter(|p| !p.optional)
                        .map(|p| p.name.as_str())
                        .collect();
                    tag_item(tag, &required, range)
                })
                .collect();
        }

        let Some((tag, provided)) = tag_context(text, offset) else {
            return Vec::new();
        };
        // Replace the sigil-prefixed token being typed (so accepting after typing
        // `:`/`@`/`~` doesn't leave a stray leading sigil → `::name`).
        let start_char = token_start_char(text, offset, pos.character);
        let range = Range {
            start: Position {
                line: pos.line,
                character: start_char,
            },
            end: pos,
        };

        let mut items = Vec::new();
        // Bindings valid on ANY element inside a tag: two-way model + DOM events.
        items.push(binding_item("~model", "two-way bound value", range));
        items.push(binding_item("~onmodel", "model write transform", range));
        for e in EVENT_NAMES {
            items.push(binding_item(
                &format!("@{e}"),
                &format!("{e} event handler"),
                range,
            ));
        }
        // Props are component-specific: only for a registered component tag, and
        // only those not already bound.
        if let Some(props) = self.props.get(&tag) {
            items.extend(
                props
                    .iter()
                    .filter(|p| !provided.contains(&p.name))
                    .map(|p| prop_item(p, range)),
            );
        }
        items
    }

    /// Hover: a `// #…` compiler hint's doc, or a component tag's props type.
    fn hover(&self, params: &HoverParams) -> Option<Hover> {
        let tdp = &params.text_document_position_params;
        let path = uri_to_path(&tdp.text_document.uri)?;
        let text = self.open.get(&path).or_else(|| self.base.get(&path))?;

        // 1) Compiler-hint hover on a `// #…` line.
        if let Some(line) = line_text(text, tdp.position.line) {
            if let Some((name, start, end)) = hint_at(line, tdp.position.character as usize) {
                if let Some(hint) = HINTS.iter().find(|h| h.name == name) {
                    return Some(Hover {
                        contents: HoverContents::Markup(MarkupContent {
                            kind: MarkupKind::Markdown,
                            value: format!(
                                "**{}** - elemix compiler hint\n\n{}",
                                hint.name, hint.doc
                            ),
                        }),
                        range: Some(Range {
                            start: Position {
                                line: tdp.position.line,
                                character: start as u32,
                            },
                            end: Position {
                                line: tdp.position.line,
                                character: end as u32,
                            },
                        }),
                    });
                }
            }
        }

        // 2) Component-tag hover: the props type for `<todo-item …>`, `<todo-item/>`
        // or `</todo-item>`. Only for a registered component tag.
        let offset = offset_of(text, tdp.position.line, tdp.position.character);
        let (tag, name_start, name_end) = component_tag_at(text, offset)?;
        if !self.component_classes.contains_key(&tag) && !self.props.contains_key(&tag) {
            return None;
        }
        Some(Hover {
            contents: HoverContents::Markup(MarkupContent {
                kind: MarkupKind::Markdown,
                value: self.props_markdown(&tag),
            }),
            range: Some(Range {
                start: position_of(text, name_start),
                end: position_of(text, name_end),
            }),
        })
    }

    /// The hover markdown for a component `tag`: its props type as a TS code block,
    /// or a "no props" note. Reads the declaring file to extract the actual type;
    /// falls back to the known prop names when the type can't be located/parsed.
    fn props_markdown(&self, tag: &str) -> String {
        let header = format!("**`<{tag}>`** - elemix component\n\n");

        if let (Some(class), Some(file)) =
            (self.component_classes.get(tag), self.components.get(tag))
        {
            if let Some(src) = self.open.get(file).or_else(|| self.base.get(file)) {
                match component_props_type(class, src) {
                    PropsExtract::NoProps => return format!("{header}*No props.*"),
                    PropsExtract::Type(ty) => {
                        return format!("{header}```typescript\n{ty}\n```");
                    }
                    PropsExtract::Unknown => {}
                }
            }
        }

        // Fallback: the prop names we enumerated (no per-prop types available).
        match self.props.get(tag) {
            Some(props) if !props.is_empty() => {
                let body = props
                    .iter()
                    .map(|p| {
                        format!(
                            "    {}{}: unknown;",
                            p.name,
                            if p.optional { "?" } else { "" }
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                format!("{header}```typescript\nprops: {{\n{body}\n}}\n```")
            }
            _ => format!("{header}*No props.*"),
        }
    }

    /// Offer an "Import '<tag>'" quick-fix for each unimported-component warning
    /// (badge `import`) in range - inserting a side-effect import at the top.
    // `WorkspaceEdit.changes` is keyed by `Uri` (lsp-types' choice); its interior
    // mutability is a parse cache that doesn't affect Hash/Eq.
    #[allow(clippy::mutable_key_type)]
    fn code_actions(&self, params: &CodeActionParams) -> Vec<CodeActionOrCommand> {
        let uri = &params.text_document.uri;
        let Some(path) = uri_to_path(uri) else {
            return Vec::new();
        };
        let Some(text) = self.open.get(&path).or_else(|| self.base.get(&path)) else {
            return Vec::new();
        };
        let mut actions = Vec::new();
        for diag in &params.context.diagnostics {
            if !matches!(&diag.code, Some(NumberOrString::String(s)) if s == "import") {
                continue;
            }
            // The tag is the text the warning carets.
            let start = offset_of(text, diag.range.start.line, diag.range.start.character);
            let end = offset_of(text, diag.range.end.line, diag.range.end.character);
            let Some(tag) = text.get(start..end) else {
                continue;
            };
            let Some(file) = self.components.get(tag) else {
                continue;
            };
            let spec = imports::import_specifier(file, &path, &self.root);
            let line = import_insert_line(text);
            let edit = TextEdit {
                range: Range {
                    start: Position { line, character: 0 },
                    end: Position { line, character: 0 },
                },
                new_text: format!("import '{spec}';\n"),
            };
            let mut changes = HashMap::new();
            changes.insert(uri.clone(), vec![edit]);
            actions.push(CodeActionOrCommand::CodeAction(CodeAction {
                title: format!("Import '{tag}'"),
                kind: Some(CodeActionKind::QUICKFIX),
                diagnostics: Some(vec![diag.clone()]),
                edit: Some(WorkspaceEdit {
                    changes: Some(changes),
                    ..Default::default()
                }),
                ..Default::default()
            }));
        }
        actions
    }

    fn analyze_and_publish(&mut self, connection: &Connection) {
        self.dirty = false;
        let files = self.snapshot();
        if files.is_empty() {
            return;
        }

        let analysis = match analyze::analyze(&self.root, &files, &TscOracle, true) {
            Ok(a) => a,
            Err(e) => {
                eprintln!("elemix-analyzer lsp: {e}");
                return;
            }
        };
        self.props = analysis.props.clone();
        self.components = analysis.components.clone();
        self.component_classes = analysis.component_classes.clone();

        let sources: HashMap<String, String> = files
            .iter()
            .map(|(p, s)| (p.to_string_lossy().into_owned(), s.clone()))
            .collect();
        let located = report::lsp_findings(&analysis.findings, |f| sources.get(f).cloned());

        // Bucket diagnostics by file path.
        let mut by_path: HashMap<String, Vec<Diagnostic>> = HashMap::new();
        for f in located {
            by_path
                .entry(f.file.clone())
                .or_default()
                .push(to_diagnostic(&f));
        }

        // Publish current findings, then clear any file that was flagged before and
        // is now clean.
        let now: HashSet<String> = by_path.keys().cloned().collect();
        for (path, diagnostics) in by_path {
            if let Some(uri) = path_to_uri(&path) {
                publish(connection, uri, diagnostics);
            }
        }
        for stale in self.published.difference(&now) {
            if let Some(uri) = path_to_uri(stale) {
                publish(connection, uri, Vec::new());
            }
        }
        self.published = now;
    }
}

fn to_diagnostic(f: &LspFinding) -> Diagnostic {
    Diagnostic {
        range: Range {
            start: Position {
                line: f.start_line,
                character: f.start_char,
            },
            end: Position {
                line: f.end_line,
                character: f.end_char,
            },
        },
        severity: Some(if f.severity == 2 {
            DiagnosticSeverity::WARNING
        } else {
            DiagnosticSeverity::ERROR
        }),
        code: Some(NumberOrString::String(f.code.clone())),
        source: Some("elemix-analyzer".to_string()),
        message: f.message.clone(),
        ..Default::default()
    }
}

fn publish(connection: &Connection, uri: Uri, diagnostics: Vec<Diagnostic>) {
    let params = PublishDiagnosticsParams {
        uri,
        diagnostics,
        version: None,
    };
    let Ok(value) = serde_json::to_value(params) else {
        return;
    };
    let _ = connection.sender.send(Message::Notification(Notification {
        method: "textDocument/publishDiagnostics".to_string(),
        params: value,
    }));
}

fn workspace_root(init: &InitializeParams) -> Option<PathBuf> {
    let folder = init.workspace_folders.as_ref()?.first()?;
    uri_to_path(&folder.uri)
}

fn resolve_root(root_arg: &str) -> PathBuf {
    std::fs::canonicalize(root_arg).unwrap_or_else(|_| PathBuf::from(root_arg))
}

/// Decode a `file://` URI's path back to an OS path. `lsp_types::Uri` derefs to
/// `fluent_uri::Uri`, so we take its percent-decoded path component.
fn uri_to_path(uri: &Uri) -> Option<PathBuf> {
    let decoded = uri.path().as_estr().decode().into_string_lossy();
    let s: &str = decoded.as_ref();
    // A Windows file URI path looks like "/C:/...": drop the leading slash.
    let cleaned = if cfg!(windows)
        && s.as_bytes().first() == Some(&b'/')
        && s.as_bytes().get(2) == Some(&b':')
    {
        &s[1..]
    } else {
        s
    };
    let path = PathBuf::from(cleaned);
    Some(std::fs::canonicalize(&path).unwrap_or(path))
}

/// Build a `file://` URI from an absolute OS path, percent-encoding everything
/// outside the URI unreserved set (RFC 3986) while keeping path separators.
fn path_to_uri(path: &str) -> Option<Uri> {
    let mut s = String::from("file://");
    if !path.starts_with('/') {
        s.push('/');
    }
    for &b in path.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                s.push(b as char);
            }
            _ => {
                s.push('%');
                s.push(hex(b >> 4));
                s.push(hex(b & 0xf));
            }
        }
    }
    s.parse().ok()
}

fn hex(nibble: u8) -> char {
    char::from(match nibble {
        0..=9 => b'0' + nibble,
        _ => b'A' + (nibble - 10),
    })
}

/// Skip dependency and build-output trees so we don't parse the world.
fn is_ignored(path: &Path) -> bool {
    path.components().any(|c| {
        matches!(
            c.as_os_str().to_str(),
            Some("node_modules") | Some("dist") | Some(".git") | Some("target")
        )
    })
}

/// Drop this process's throwaway overlay dir wholesale, in case a prior server
/// with the same pid was killed before its own cleanup ran. The oracle also
/// clears it at the start of every run, so this is just belt-and-suspenders.
fn sweep_temp(root: &Path) {
    let _ = std::fs::remove_dir_all(crate::oracle::cache_dir(root));
}

/// The component tag whose open `<tag …>` contains `offset` (inside a `tpl`
/// template), plus the prop names already bound there. Works ANYWHERE in the open
/// tag: it scans the tag body skipping over `${…}` interpolations (whose `=>`
/// arrows and `>`s must NOT be mistaken for the tag close) and quoted attribute
/// values. `None` when the cursor isn't in a bindable tag position.
fn tag_context(text: &str, offset: usize) -> Option<(String, Vec<String>)> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    // Scan the WHOLE open tag - not just the text up to the cursor - so a prop
    // counts as bound no matter where in the tag it sits relative to the caret.
    // Listing only *unused* props must not depend on caret position.
    let s = &text[lt + 1..];
    let bytes = s.as_bytes();
    let cursor = offset - (lt + 1);

    // Tag name: the leading identifier after `<`.
    let mut i = 0;
    while i < bytes.len()
        && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'-' || bytes[i] == b'_')
    {
        i += 1;
    }
    let tag = s[..i].to_string();
    if tag.is_empty() {
        return None;
    }

    // Walk the tag body: the first real `>` (outside `${…}` / quotes) closes the
    // tag - if it precedes the cursor the caret is past the tag; otherwise collect
    // every `:prop=` bound anywhere in the tag.
    let mut provided = Vec::new();
    let mut brace_depth = 0u32;
    let mut quote: Option<u8> = None;
    while i < bytes.len() {
        let c = bytes[i];
        if brace_depth > 0 {
            match c {
                b'{' => brace_depth += 1,
                b'}' => brace_depth -= 1,
                _ => {}
            }
            i += 1;
            continue;
        }
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
            i += 1;
            continue;
        }
        match c {
            b'$' if bytes.get(i + 1) == Some(&b'{') => {
                brace_depth = 1;
                i += 2;
            }
            b'"' | b'\'' => {
                quote = Some(c);
                i += 1;
            }
            // Tag close: the caret must sit at or before it to be inside the tag.
            b'>' => {
                if i < cursor {
                    return None;
                }
                break;
            }
            b':' => {
                // A `:prop=` attribute (with a value) counts as already bound. The
                // bare token being typed at the caret has no `=` yet, so it is not
                // collected and stays offerable.
                let start = i + 1;
                let mut j = start;
                while j < bytes.len()
                    && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'-' || bytes[j] == b'_')
                {
                    j += 1;
                }
                if j > start {
                    let mut k = j;
                    while k < bytes.len() && bytes[k] == b' ' {
                        k += 1;
                    }
                    if bytes.get(k) == Some(&b'=') {
                        provided.push(s[start..j].to_string());
                    }
                }
                i = j;
            }
            _ => i += 1,
        }
    }
    Some((tag, provided))
}

/// When the cursor is typing a tag NAME just after `<` inside a `tpl` template,
/// returns the partial name typed so far. `None` once a space/`>`/`/` follows the
/// name (that's the attribute zone, handled by [`tag_context`]) or outside a tpl.
fn tag_name_context(text: &str, offset: usize) -> Option<String> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    let after = &before[lt + 1..];
    // Only a bare identifier so far means we're still in the tag name.
    if after
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        Some(after.to_string())
    } else {
        None
    }
}

/// A component tag completion: inserts a self-closed `<tag />`, or, when the
/// component has REQUIRED props, `<tag :a=${1} :b=${2} />` with the caret in the
/// first prop hole. Optional props are left for the user to add.
fn tag_item(tag: &str, required: &[&str], range: Range) -> CompletionItem {
    let new_text = if required.is_empty() {
        format!("{tag} />")
    } else {
        let holes = required
            .iter()
            .enumerate()
            .map(|(i, p)| format!(":{p}=\\${{${n}}}", n = i + 1))
            .collect::<Vec<_>>()
            .join(" ");
        format!("{tag} {holes} />")
    };
    CompletionItem {
        kind: Some(CompletionItemKind::CLASS),
        detail: Some("component".to_string()),
        text_edit: Some(CompletionTextEdit::Edit(TextEdit { range, new_text })),
        insert_text_format: Some(InsertTextFormat::SNIPPET),
        filter_text: Some(tag.to_string()),
        label: tag.to_string(),
        ..Default::default()
    }
}

/// The 0-based line to insert a new import on: just after the last top-level
/// `import` statement, or the top of the file if there are none.
fn import_insert_line(text: &str) -> u32 {
    let mut after = 0u32;
    for (i, line) in text.lines().enumerate() {
        let t = line.trim_start();
        if t.starts_with("import ") || t.starts_with("import'") || t.starts_with("import\"") {
            after = i as u32 + 1;
        }
    }
    after
}

/// True when `lt` (a `<`) sits inside an unclosed `tpl\`` template literal.
fn in_tpl_template(before: &str, lt: usize) -> bool {
    let head = &before[..lt];
    match head.rfind("tpl`") {
        Some(open) => !head[open + 4..].contains('`'),
        None => false,
    }
}

/// The component tag whose NAME the cursor sits on, inside a `tpl` template: for
/// `<todo-item …>`, `<todo-item/>` or `</todo-item>`. Returns the tag plus the
/// byte span of its name (for the hover range). `None` when the cursor isn't on a
/// tag name (e.g. it's past the name, in the attribute zone) or outside a tpl.
fn component_tag_at(text: &str, offset: usize) -> Option<(String, usize, usize)> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    let bytes = text.as_bytes();
    // The name starts after `<` (skipping a `/` for a closing tag).
    let name_start = if bytes.get(lt + 1) == Some(&b'/') {
        lt + 2
    } else {
        lt + 1
    };
    let mut j = name_start;
    while j < bytes.len()
        && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'-' || bytes[j] == b'_')
    {
        j += 1;
    }
    // Empty name, or the cursor is past the name (attribute zone / text): not a
    // tag-name hover.
    if j == name_start || offset > j {
        return None;
    }
    Some((text[name_start..j].to_string(), name_start, j))
}

/// UTF-8 byte offset in `text` → LSP position (0-based line, UTF-16 character).
fn position_of(text: &str, offset: usize) -> Position {
    let mut line = 0u32;
    let mut character = 0u32;
    let mut cur = 0usize;
    for ch in text.chars() {
        if cur >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            character = 0;
        } else {
            character += ch.len_utf16() as u32;
        }
        cur += ch.len_utf8();
    }
    Position { line, character }
}

/// The outcome of reading a component's props type from its declaring source.
enum PropsExtract {
    /// `extends Component` with no type argument → the component has no props.
    NoProps,
    /// The props type text to show (a resolved `type`/`interface` def, or the
    /// inline object type).
    Type(String),
    /// The class/extends clause couldn't be located or parsed - fall back to the
    /// enumerated prop names.
    Unknown,
}

/// Read a component class's props type from `src`: the type argument of
/// `extends Component<…>`, resolved to its `type`/`interface` definition when it's
/// a named type declared in the same file, or the inline object type verbatim.
fn component_props_type(class: &str, src: &str) -> PropsExtract {
    let Some(after) = phrase_end("class", class, src) else {
        return PropsExtract::Unknown;
    };
    let header = &src[after..];
    // `extends` … `Component` … then the generic argument (if any).
    let Some(ext) = header.find("extends") else {
        return PropsExtract::Unknown;
    };
    let post = &header[ext + "extends".len()..];
    let Some(comp) = post.find("Component") else {
        return PropsExtract::Unknown;
    };
    let after_comp = post[comp + "Component".len()..].trim_start();
    let Some(rest) = after_comp.strip_prefix('<') else {
        return PropsExtract::NoProps; // `extends Component` with no props
    };
    let Some(arg) = balanced_angle_content(rest) else {
        return PropsExtract::Unknown;
    };
    let arg = arg.trim();
    if arg.is_empty() {
        return PropsExtract::NoProps;
    }
    if arg.starts_with('{') {
        // An inline object type - show it as-is.
        return PropsExtract::Type(format!("props: {arg}"));
    }
    // A named type: resolve its declaration in the same file; else name it.
    let base = arg
        .split(|c: char| c == '<' || c == '|' || c == '&' || c.is_whitespace())
        .next()
        .unwrap_or(arg)
        .trim();
    match resolve_type_def(base, src) {
        Some(def) => PropsExtract::Type(def),
        None => PropsExtract::Type(format!("props: {arg}")),
    }
}

/// Content between a `<` (already consumed) and its matching `>`.
fn balanced_angle_content(after_lt: &str) -> Option<&str> {
    let mut depth = 1i32;
    for (i, &b) in after_lt.as_bytes().iter().enumerate() {
        match b {
            b'<' => depth += 1,
            b'>' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&after_lt[..i]);
                }
            }
            _ => {}
        }
    }
    None
}

/// Resolve a named type to its source definition: a `type X = …;` alias or an
/// `interface X { … }`, declared in `src`. `None` when neither is found (e.g. the
/// type is imported).
fn resolve_type_def(name: &str, src: &str) -> Option<String> {
    if let Some(after) = phrase_end("type", name, src) {
        let rest = src[after..].trim_start();
        if let Some(rhs) = rest.strip_prefix('=') {
            let body = read_to_semicolon(rhs.trim_start());
            return Some(format!("type {name} = {};", body.trim()));
        }
    }
    if let Some(after) = phrase_end("interface", name, src) {
        if let Some(brace) = src[after..].find('{') {
            let from = after + brace;
            if let Some(body) = balanced_braces(&src[from..]) {
                return Some(format!("interface {name} {body}"));
            }
        }
    }
    None
}

/// The byte index just past `"{prefix} {name}"` in `src`, matched on identifier
/// boundaries. `None` if absent.
fn phrase_end(prefix: &str, name: &str, src: &str) -> Option<usize> {
    let needle = format!("{prefix} {name}");
    let bytes = src.as_bytes();
    let ident = |b: u8| b.is_ascii_alphanumeric() || b == b'_';
    let mut from = 0;
    while let Some(rel) = src[from..].find(&needle) {
        let pos = from + rel;
        let end = pos + needle.len();
        let before_ok = pos == 0 || !ident(bytes[pos - 1]);
        let after_ok = bytes.get(end).is_none_or(|&b| !ident(b));
        if before_ok && after_ok {
            return Some(end);
        }
        from = end;
    }
    None
}

/// Read from the start of `s` up to the first `;` at brace/paren/bracket depth 0
/// (so `;` separators inside an object type don't end it early). Returns all of
/// `s` when there's no such terminator.
fn read_to_semicolon(s: &str) -> &str {
    let (mut curly, mut paren, mut square) = (0i32, 0i32, 0i32);
    for (i, &b) in s.as_bytes().iter().enumerate() {
        match b {
            b'{' => curly += 1,
            b'}' => curly -= 1,
            b'(' => paren += 1,
            b')' => paren -= 1,
            b'[' => square += 1,
            b']' => square -= 1,
            b';' if curly <= 0 && paren <= 0 && square <= 0 => return &s[..i],
            _ => {}
        }
    }
    s
}

/// The balanced `{ … }` block starting at `s[0] == '{'`, braces included.
fn balanced_braces(s: &str) -> Option<&str> {
    let mut depth = 0i32;
    for (i, &b) in s.as_bytes().iter().enumerate() {
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&s[..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

/// The completion replace-range start (as a 0-based UTF-16 character on the
/// cursor's line): the `:`-prefixed token being typed just before the cursor.
fn token_start_char(text: &str, offset: usize, cursor_char: u32) -> u32 {
    let before = &text[..offset];
    let bytes = before.as_bytes();
    let mut start = offset;
    while start > 0 {
        let c = bytes[start - 1];
        if c.is_ascii_alphanumeric() || c == b'-' || c == b'_' {
            start -= 1;
        } else {
            break;
        }
    }
    if start > 0 && matches!(bytes[start - 1], b':' | b'@' | b'~') {
        start -= 1;
    }
    let back: u32 = before[start..offset]
        .chars()
        .map(|c| c.len_utf16() as u32)
        .sum();
    cursor_char.saturating_sub(back)
}

/// LSP position (0-based line, UTF-16 char) → UTF-8 byte offset in `text`.
fn offset_of(text: &str, line: u32, character: u32) -> usize {
    let mut off = 0usize;
    for (i, l) in text.split_inclusive('\n').enumerate() {
        if i as u32 == line {
            let mut units = 0u32;
            for ch in l.chars() {
                if units >= character {
                    break;
                }
                units += ch.len_utf16() as u32;
                off += ch.len_utf8();
            }
            return off;
        }
        off += l.len();
    }
    off
}

/// A `:prop` completion item: inserts `:name=${$1}` with the caret in the hole.
/// An elemix compiler hint (`// #…` macro) for completion + hover.
struct Hint {
    name: &'static str,
    detail: &'static str,
    doc: &'static str,
    snippet: Option<&'static str>,
}

const HINTS: &[Hint] = &[
    Hint {
        name: "#component",
        detail: "class → register as a custom element",
        doc: "Registers the class as a custom element (emits `defineComponent`). Place above the class - without it the element is never defined and `<my-element>` stays inert.",
        snippet: None,
    },
    Hint {
        name: "#tag",
        detail: "class → set the custom element tag name",
        doc: "Sets the custom element tag name.\n\n```ts\n// #tag user-card\n```\n\nPlace above the class. The name must contain a hyphen.",
        snippet: Some("#tag ${1:my-element}"),
    },
    Hint {
        name: "#form",
        detail: "class → form-associated custom element",
        doc: "A form-associated custom element - works inside a form like a native input. Place above the class.",
        snippet: None,
    },
    Hint {
        name: "#no-shadow",
        detail: "class → render to light DOM (no shadow root)",
        doc: "Renders into the **light DOM** instead of a shadow root (skips `attachShadow`). Styles are not encapsulated. Place above the class.",
        snippet: None,
    },
    Hint {
        name: "#shadow",
        detail: "class → force a shadow root",
        doc: "Forces a **shadow root** (`attachShadow`) when light DOM is the default. Place above the class.",
        snippet: None,
    },
    Hint {
        name: "#styles",
        detail: "member → component styles (CSS string)",
        doc: "Component styles, as a string. Adopted into the shadow root. Place above the field.",
        snippet: None,
    },
    Hint {
        name: "#state",
        detail: "field or export → reactive state / store",
        doc: "Marks reactive state: component state on a class field, a store (global state) on a module-level export.",
        snippet: None,
    },
    Hint {
        name: "#effect",
        detail: "member → reactive effect",
        doc: "Marks a method/arrow as a **reactive effect** - it re-runs whenever the state it reads changes. Place above the member.",
        snippet: None,
    },
    Hint {
        name: "#before-mount",
        detail: "member → lifecycle: before mount",
        doc: "Lifecycle hook: runs **before** the component mounts (before the first render). Place above a method.",
        snippet: None,
    },
    Hint {
        name: "#mount",
        detail: "member → lifecycle: on mount",
        doc: "Lifecycle hook: runs **after** the component mounts (connected and first render done). Place above a method.",
        snippet: None,
    },
    Hint {
        name: "#dispose",
        detail: "member → lifecycle: on dispose",
        doc: "Lifecycle hook: runs when the component is **disposed** (disconnected). Place above a method.",
        snippet: None,
    },
];

/// A compiler-hint completion item (keyword-kind, with detail + markdown doc).
fn hint_item(h: &Hint, range: Range) -> CompletionItem {
    let (new_text, fmt) = match h.snippet {
        Some(s) => (s.to_string(), InsertTextFormat::SNIPPET),
        None => (h.name.to_string(), InsertTextFormat::PLAIN_TEXT),
    };
    CompletionItem {
        kind: Some(CompletionItemKind::KEYWORD),
        detail: Some(h.detail.to_string()),
        documentation: Some(Documentation::MarkupContent(MarkupContent {
            kind: MarkupKind::Markdown,
            value: h.doc.to_string(),
        })),
        text_edit: Some(CompletionTextEdit::Edit(TextEdit { range, new_text })),
        insert_text_format: Some(fmt),
        filter_text: Some(h.name.to_string()),
        label: h.name.to_string(),
        ..Default::default()
    }
}

/// The text from the start of the cursor's line up to the cursor.
fn line_before_cursor(text: &str, offset: usize) -> &str {
    let start = text[..offset].rfind('\n').map(|i| i + 1).unwrap_or(0);
    &text[start..offset]
}

/// The Nth (0-based) line of `text`, without its newline.
fn line_text(text: &str, line: u32) -> Option<&str> {
    text.lines().nth(line as usize)
}

/// On a `// #…` hint comment, the trailing `#?word` token being typed - the cue to
/// offer hint completions. `None` on a non-hint comment or outside one. Only the
/// text after `//` is validated: whitespace + already-typed `#word`s, then the token.
fn pragma_token(before: &str) -> Option<&str> {
    let bytes = before.as_bytes();
    // The trailing `[#\w-]*` run is the token being typed.
    let mut ts = before.len();
    while ts > 0 {
        let c = bytes[ts - 1];
        if c.is_ascii_alphanumeric() || c == b'-' || c == b'_' || c == b'#' {
            ts -= 1;
        } else {
            break;
        }
    }
    let token = &before[ts..];
    // Everything before the token must be `\s*//\s*(#word\s+)*`.
    let prefix = before[..ts].trim_start();
    let rest = prefix.strip_prefix("//")?;
    let mut r = rest.trim_start();
    while !r.is_empty() {
        if !r.starts_with('#') {
            return None;
        }
        let end = r[1..]
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == '_'))
            .map_or(r.len(), |i| i + 1);
        r = r[end..].trim_start();
    }
    Some(token)
}

/// The `#…` hint token under `character` (a UTF-16 column) on a `// #…` line, with
/// its column span. `None` off a token or on a non-hint comment.
fn hint_at(line: &str, character: usize) -> Option<(&str, usize, usize)> {
    let t = line.trim_start();
    if !(t.starts_with("//") && t[2..].trim_start().starts_with('#')) {
        return None;
    }
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'#' {
            let start = i;
            let mut j = i + 1;
            while j < bytes.len()
                && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'-' || bytes[j] == b'_')
            {
                j += 1;
            }
            if j > start + 1 && character >= start && character <= j {
                return Some((&line[start..j], start, j));
            }
            i = j;
        } else {
            i += 1;
        }
    }
    None
}

/// Every DOM event an `@event` binding can wire up.
const EVENT_NAMES: &[&str] = &[
    "click",
    "dblclick",
    "auxclick",
    "contextmenu",
    "mousedown",
    "mouseup",
    "mousemove",
    "mouseover",
    "mouseout",
    "mouseenter",
    "mouseleave",
    "wheel",
    "pointerdown",
    "pointerup",
    "pointermove",
    "pointerover",
    "pointerout",
    "pointerenter",
    "pointerleave",
    "pointercancel",
    "gotpointercapture",
    "lostpointercapture",
    "keydown",
    "keyup",
    "keypress",
    "input",
    "beforeinput",
    "change",
    "submit",
    "reset",
    "invalid",
    "formdata",
    "select",
    "search",
    "focus",
    "blur",
    "focusin",
    "focusout",
    "copy",
    "cut",
    "paste",
    "drag",
    "dragstart",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "drop",
    "touchstart",
    "touchend",
    "touchmove",
    "touchcancel",
    "scroll",
    "scrollend",
    "resize",
    "animationstart",
    "animationend",
    "animationiteration",
    "animationcancel",
    "transitionstart",
    "transitionend",
    "transitionrun",
    "transitioncancel",
    "compositionstart",
    "compositionupdate",
    "compositionend",
    "play",
    "playing",
    "pause",
    "ended",
    "volumechange",
    "timeupdate",
    "durationchange",
    "ratechange",
    "seeking",
    "seeked",
    "waiting",
    "stalled",
    "suspend",
    "emptied",
    "abort",
    "canplay",
    "canplaythrough",
    "loadeddata",
    "loadedmetadata",
    "loadstart",
    "progress",
    "load",
    "error",
    "toggle",
    "beforetoggle",
    "cancel",
    "close",
    "cuechange",
    "slotchange",
];

/// A `~model`/`~onmodel`/`@event` binding item - valid on any element inside a
/// tag. Inserts `label=${$1}` (caret in the hole), replacing the typed sigil.
fn binding_item(label: &str, detail: &str, range: Range) -> CompletionItem {
    let kind = if label.starts_with('@') {
        CompletionItemKind::EVENT
    } else {
        CompletionItemKind::PROPERTY
    };
    CompletionItem {
        kind: Some(kind),
        detail: Some(detail.to_string()),
        text_edit: Some(CompletionTextEdit::Edit(TextEdit {
            range,
            new_text: format!("{label}=\\${{$1}}"),
        })),
        insert_text_format: Some(InsertTextFormat::SNIPPET),
        filter_text: Some(label.to_string()),
        label: label.to_string(),
        ..Default::default()
    }
}

fn prop_item(p: &PropInfo, range: Range) -> CompletionItem {
    let label = format!(":{}", p.name);
    let new_text = format!(":{}=\\${{$1}}", p.name);
    CompletionItem {
        kind: Some(CompletionItemKind::PROPERTY),
        detail: Some(
            if p.optional {
                "optional prop"
            } else {
                "required prop"
            }
            .to_string(),
        ),
        // A textEdit over the typed token replaces the trigger `:` in place.
        text_edit: Some(CompletionTextEdit::Edit(TextEdit { range, new_text })),
        insert_text_format: Some(InsertTextFormat::SNIPPET),
        filter_text: Some(label.clone()),
        label,
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::LspFinding;

    #[test]
    fn pragma_token_detects_the_hint_context() {
        assert_eq!(pragma_token("    // #comp"), Some("#comp"));
        assert_eq!(pragma_token("// #component #ta"), Some("#ta"));
        assert_eq!(pragma_token("  // "), Some("")); // right after //
        assert_eq!(pragma_token("const x = 5"), None); // not a comment
        assert_eq!(pragma_token("// see the #foo"), None); // prose before the #
    }

    #[test]
    fn hint_at_finds_the_hint_token() {
        let line = "    // #component #tag";
        assert_eq!(hint_at(line, 10).map(|(n, ..)| n), Some("#component"));
        assert_eq!(hint_at(line, 6), None); // off any token
        assert_eq!(hint_at("// plain comment", 5), None); // not a hint comment
    }

    #[test]
    fn component_tag_at_finds_open_close_and_selfclose() {
        // open tag, cursor on the name
        let t = "x = tpl`<todo-item :a=${1}>`";
        let off = t.find("todo").unwrap() + 2;
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        // closing tag
        let t = "x = tpl`</todo-item>`";
        let off = t.find("todo").unwrap() + 1;
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        // self-closing
        let t = "x = tpl`<todo-item />`";
        let off = t.find("item").unwrap();
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        // cursor past the name (attribute zone) → no tag-name hover
        let t = "x = tpl`<todo-item  :a=${1}>`";
        let off = t.find(":a").unwrap();
        assert_eq!(component_tag_at(t, off), None);
        // not inside a tpl
        assert_eq!(component_tag_at("<todo-item>", 4), None);
    }

    #[test]
    fn component_props_type_resolves_named_type() {
        let src = "type Props = {\n    todo: Todo;\n    remove: () => void;\n    test?: string;\n};\nexport class TodoItem extends Component<Props> {}";
        match component_props_type("TodoItem", src) {
            PropsExtract::Type(t) => {
                assert!(t.starts_with("type Props = {"), "{t}");
                assert!(t.contains("todo: Todo;"), "{t}");
                assert!(t.contains("remove: () => void;"), "{t}");
                assert!(t.contains("test?: string;"), "{t}");
                assert!(t.trim_end().ends_with("};"), "{t}");
            }
            _ => panic!("expected a resolved type"),
        }
    }

    #[test]
    fn component_props_type_handles_inline_and_none() {
        // inline object type
        match component_props_type("Card", "class Card extends Component<{ x: number }> {}") {
            PropsExtract::Type(t) => assert_eq!(t, "props: { x: number }"),
            _ => panic!("expected inline type"),
        }
        // no generic → no props
        assert!(matches!(
            component_props_type("Bare", "class Bare extends Component {}"),
            PropsExtract::NoProps
        ));
        // class not found
        assert!(matches!(
            component_props_type("Missing", "const x = 1;"),
            PropsExtract::Unknown
        ));
    }

    #[test]
    fn component_props_type_resolves_interface() {
        let src = "interface Props { name: string }\nclass X extends Component<Props> {}";
        match component_props_type("X", src) {
            PropsExtract::Type(t) => {
                assert!(t.starts_with("interface Props {"), "{t}");
                assert!(t.contains("name: string"), "{t}");
            }
            _ => panic!("expected interface"),
        }
    }

    #[test]
    fn tag_name_context_detects_the_partial_tag() {
        assert_eq!(tag_name_context("x = tpl`<", 9), Some(String::new()));
        assert_eq!(
            tag_name_context("x = tpl`<todo", 13),
            Some("todo".to_string())
        );
        // A space after the name = attribute zone, not tag-name completion.
        assert_eq!(tag_name_context("x = tpl`<div ", 13), None);
        // Not inside a tpl.
        assert_eq!(tag_name_context("plain text", 5), None);
    }

    #[test]
    fn hex_maps_every_nibble() {
        assert_eq!(hex(0), '0');
        assert_eq!(hex(9), '9');
        assert_eq!(hex(10), 'A');
        assert_eq!(hex(15), 'F');
    }

    #[test]
    fn uri_path_roundtrips_plain_ascii() {
        let uri = path_to_uri("/home/user/src/App.ts").unwrap();
        assert_eq!(uri.as_str(), "file:///home/user/src/App.ts");
        assert_eq!(
            uri_to_path(&uri).unwrap(),
            PathBuf::from("/home/user/src/App.ts")
        );
    }

    #[test]
    fn uri_encodes_then_decodes_spaces_and_unicode() {
        // These paths don't exist, so uri_to_path returns the decoded path as-is
        // (canonicalize falls back), which is exactly what we want to assert on.
        let uri = path_to_uri("/home/u ser/naïve.ts").unwrap();
        let s = uri.as_str();
        assert!(s.contains("%20"), "space is percent-encoded: {s}");
        assert!(!s.contains(' '), "no raw spaces survive: {s}");
        assert!(s.is_ascii(), "unicode is percent-encoded to ASCII: {s}");
        assert_eq!(
            uri_to_path(&uri).unwrap(),
            PathBuf::from("/home/u ser/naïve.ts")
        );
    }

    #[test]
    fn is_ignored_skips_deps_and_build_trees() {
        assert!(is_ignored(Path::new("/p/node_modules/x.ts")));
        assert!(is_ignored(Path::new("/p/dist/bundle.ts")));
        assert!(is_ignored(Path::new("/p/.git/HEAD")));
        assert!(is_ignored(Path::new("/p/target/debug/x")));
        assert!(!is_ignored(Path::new("/p/src/components/Card.ts")));
    }

    fn finding(severity: u8) -> LspFinding {
        LspFinding {
            file: "/p/a.ts".into(),
            start_line: 4,
            start_char: 2,
            end_line: 4,
            end_char: 9,
            severity,
            code: "TS2345".into(),
            message: "bad".into(),
        }
    }

    #[test]
    fn to_diagnostic_maps_error_severity_code_and_range() {
        let d = to_diagnostic(&finding(1));
        assert_eq!(d.severity, Some(DiagnosticSeverity::ERROR));
        assert_eq!(d.source.as_deref(), Some("elemix-analyzer"));
        assert!(matches!(&d.code, Some(NumberOrString::String(s)) if s == "TS2345"));
        assert_eq!(d.range.start.line, 4);
        assert_eq!(d.range.start.character, 2);
        assert_eq!(d.range.end.line, 4);
        assert_eq!(d.range.end.character, 9);
    }

    #[test]
    fn to_diagnostic_maps_warning_severity() {
        let d = to_diagnostic(&finding(2));
        assert_eq!(d.severity, Some(DiagnosticSeverity::WARNING));
    }
}
