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
            trigger_characters: Some(vec![
                "<".to_string(),
                "#".to_string(),
                ":".to_string(),
                "@".to_string(),
                "~".to_string(),
            ]),
            ..Default::default()
        }),
        code_action_provider: Some(CodeActionProviderCapability::Simple(true)),
        hover_provider: Some(HoverProviderCapability::Simple(true)),
        ..Default::default()
    };
    let init_value = connection.initialize(serde_json::to_value(capabilities)?)?;
    let init: InitializeParams = serde_json::from_value(init_value)?;

    let root = workspace_root(&init).unwrap_or_else(|| resolve_root(root_arg));

    sweep_temp(&root);

    {
        let mut state = State::new(root);
        state.load_project();
        state.analyze_and_publish(&connection);

        loop {
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
    base: HashMap<PathBuf, String>,
    open: HashMap<PathBuf, String>,
    published: HashSet<String>,
    props: HashMap<String, Vec<PropInfo>>,
    components: HashMap<String, PathBuf>,
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

    fn text_of(&self, key: &Path) -> Option<&String> {
        self.open.get(key).or_else(|| self.base.get(key))
    }

    fn complete(&self, params: &CompletionParams) -> Vec<CompletionItem> {
        let uri = &params.text_document_position.text_document.uri;
        let Some(path) = uri_to_path(uri) else {
            return Vec::new();
        };
        let Some(text) = self.text_of(&path) else {
            return Vec::new();
        };
        let pos = params.text_document_position.position;
        let offset = offset_of(text, pos.line, pos.character);

        if let Some(items) = complete_pragma(text, offset, pos) {
            return items;
        }
        if let Some(items) = self.complete_tag_name(text, offset, pos) {
            return items;
        }
        self.complete_bindings(text, offset, pos)
    }

    fn complete_tag_name(
        &self,
        text: &str,
        offset: usize,
        pos: Position,
    ) -> Option<Vec<CompletionItem>> {
        let partial = tag_name_context(text, offset)?;
        let range = range_back(pos, &partial);
        let mut tags: Vec<&String> = self.props.keys().collect();
        tags.sort();
        Some(
            tags.into_iter()
                .map(|tag| {
                    let required: Vec<&str> = self.props[tag]
                        .iter()
                        .filter(|p| !p.optional)
                        .map(|p| p.name.as_str())
                        .collect();
                    tag_item(tag, &required, range)
                })
                .collect(),
        )
    }

    fn complete_bindings(&self, text: &str, offset: usize, pos: Position) -> Vec<CompletionItem> {
        let Some((tag, provided)) = tag_context(text, offset) else {
            return Vec::new();
        };
        let start_char = token_start_char(text, offset, pos.character);
        let range = Range {
            start: Position {
                line: pos.line,
                character: start_char,
            },
            end: pos,
        };

        let mut items = Vec::new();
        items.push(binding_item("~model", "two-way bound value", range));
        items.push(binding_item("~onmodel", "model write transform", range));
        for e in EVENT_NAMES {
            items.push(binding_item(
                &format!("@{e}"),
                &format!("{e} event handler"),
                range,
            ));
        }
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

    fn hover(&self, params: &HoverParams) -> Option<Hover> {
        let tdp = &params.text_document_position_params;
        let path = uri_to_path(&tdp.text_document.uri)?;
        let text = self.text_of(&path)?;

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

    fn props_markdown(&self, tag: &str) -> String {
        let header = format!("**`<{tag}>`** - elemix component\n\n");

        if let (Some(class), Some(file)) =
            (self.component_classes.get(tag), self.components.get(tag))
        {
            if let Some(src) = self.text_of(file) {
                match component_props_type(class, src) {
                    PropsExtract::NoProps => return format!("{header}*No props.*"),
                    PropsExtract::Type(ty) => {
                        return format!("{header}```typescript\n{ty}\n```");
                    }
                    PropsExtract::Unknown => {}
                }
            }
        }

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

    #[allow(clippy::mutable_key_type)]
    fn code_actions(&self, params: &CodeActionParams) -> Vec<CodeActionOrCommand> {
        let uri = &params.text_document.uri;
        let Some(path) = uri_to_path(uri) else {
            return Vec::new();
        };
        let Some(text) = self.text_of(&path) else {
            return Vec::new();
        };
        let mut actions = Vec::new();
        for diag in &params.context.diagnostics {
            if !matches!(&diag.code, Some(NumberOrString::String(s)) if s == "import") {
                continue;
            }
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
        self.props = analysis.props;
        self.components = analysis.components;
        self.component_classes = analysis.component_classes;

        let sources = report::source_map(&files);
        let located = report::lsp_findings(&analysis.findings, |f| sources.get(f).cloned());

        let mut by_path: HashMap<String, Vec<Diagnostic>> = HashMap::new();
        for f in located {
            by_path
                .entry(f.file.clone())
                .or_default()
                .push(to_diagnostic(&f));
        }

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

fn uri_to_path(uri: &Uri) -> Option<PathBuf> {
    let decoded = uri.path().as_estr().decode().into_string_lossy();
    let s: &str = decoded.as_ref();
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

fn is_ignored(path: &Path) -> bool {
    path.components().any(|c| {
        matches!(
            c.as_os_str().to_str(),
            Some("node_modules" | "dist" | ".git" | "target")
        )
    })
}

fn sweep_temp(root: &Path) {
    let _ = std::fs::remove_dir_all(crate::oracle::cache_dir(root));
}

fn tag_context(text: &str, offset: usize) -> Option<(String, Vec<String>)> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    let s = &text[lt + 1..];
    let bytes = s.as_bytes();
    let cursor = offset - (lt + 1);

    let mut i = 0;
    while i < bytes.len() && is_name_byte(bytes[i]) {
        i += 1;
    }
    let tag = s[..i].to_string();
    if tag.is_empty() {
        return None;
    }

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
            b'>' => {
                if i < cursor {
                    return None;
                }
                break;
            }
            b':' => {
                let start = i + 1;
                let mut j = start;
                while j < bytes.len() && is_name_byte(bytes[j]) {
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

fn tag_name_context(text: &str, offset: usize) -> Option<String> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    let after = &before[lt + 1..];
    if after.chars().all(is_name_char) {
        Some(after.to_string())
    } else {
        None
    }
}

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

fn in_tpl_template(before: &str, lt: usize) -> bool {
    let head = &before[..lt];
    match head.rfind("tpl`") {
        Some(open) => !head[open + 4..].contains('`'),
        None => false,
    }
}

fn component_tag_at(text: &str, offset: usize) -> Option<(String, usize, usize)> {
    let before = text.get(..offset)?;
    let lt = before.rfind('<')?;
    if !in_tpl_template(before, lt) {
        return None;
    }
    let bytes = text.as_bytes();
    let name_start = if bytes.get(lt + 1) == Some(&b'/') {
        lt + 2
    } else {
        lt + 1
    };
    let mut j = name_start;
    while j < bytes.len() && is_name_byte(bytes[j]) {
        j += 1;
    }
    if j == name_start || offset > j {
        return None;
    }
    Some((text[name_start..j].to_string(), name_start, j))
}

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

enum PropsExtract {
    NoProps,
    Type(String),
    Unknown,
}

fn component_props_type(class: &str, src: &str) -> PropsExtract {
    let Some(after) = phrase_end("class", class, src) else {
        return PropsExtract::Unknown;
    };
    let header = &src[after..];
    let Some(ext) = header.find("extends") else {
        return PropsExtract::Unknown;
    };
    let post = &header[ext + "extends".len()..];
    let Some(comp) = post.find("Component") else {
        return PropsExtract::Unknown;
    };
    let after_comp = post[comp + "Component".len()..].trim_start();
    let Some(rest) = after_comp.strip_prefix('<') else {
        return PropsExtract::NoProps;
    };
    let Some(arg) = balanced_angle_content(rest) else {
        return PropsExtract::Unknown;
    };
    let arg = arg.trim();
    if arg.is_empty() {
        return PropsExtract::NoProps;
    }
    if arg.starts_with('{') {
        return PropsExtract::Type(format!("props: {arg}"));
    }
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

fn scan_balanced(s: &str, open: u8, close: u8, start_depth: i32, inclusive: bool) -> Option<&str> {
    let mut depth = start_depth;
    for (i, &b) in s.as_bytes().iter().enumerate() {
        if b == open {
            depth += 1;
        } else if b == close {
            depth -= 1;
            if depth == 0 {
                return Some(if inclusive { &s[..=i] } else { &s[..i] });
            }
        }
    }
    None
}

fn balanced_angle_content(after_lt: &str) -> Option<&str> {
    scan_balanced(after_lt, b'<', b'>', 1, false)
}

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

fn balanced_braces(s: &str) -> Option<&str> {
    scan_balanced(s, b'{', b'}', 0, true)
}

fn token_start_char(text: &str, offset: usize, cursor_char: u32) -> u32 {
    let before = &text[..offset];
    let bytes = before.as_bytes();
    let mut start = offset;
    while start > 0 {
        if is_name_byte(bytes[start - 1]) {
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

fn line_before_cursor(text: &str, offset: usize) -> &str {
    let start = text[..offset].rfind('\n').map_or(0, |i| i + 1);
    &text[start..offset]
}

fn line_text(text: &str, line: u32) -> Option<&str> {
    text.lines().nth(line as usize)
}

#[inline]
fn is_name_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_'
}

#[inline]
fn is_name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '-' || c == '_'
}

fn range_back(pos: Position, token: &str) -> Range {
    let back: u32 = token.chars().map(|c| c.len_utf16() as u32).sum();
    Range {
        start: Position {
            line: pos.line,
            character: pos.character.saturating_sub(back),
        },
        end: pos,
    }
}

fn complete_pragma(text: &str, offset: usize, pos: Position) -> Option<Vec<CompletionItem>> {
    let token = pragma_token(line_before_cursor(text, offset))?;
    let range = range_back(pos, token);
    Some(HINTS.iter().map(|h| hint_item(h, range)).collect())
}

fn pragma_token(before: &str) -> Option<&str> {
    let bytes = before.as_bytes();
    let mut ts = before.len();
    while ts > 0 {
        let c = bytes[ts - 1];
        if is_name_byte(c) || c == b'#' {
            ts -= 1;
        } else {
            break;
        }
    }
    let token = &before[ts..];
    let prefix = before[..ts].trim_start();
    let rest = prefix.strip_prefix("//")?;
    let mut r = rest.trim_start();
    while !r.is_empty() {
        if !r.starts_with('#') {
            return None;
        }
        let end = r[1..]
            .find(|c: char| !is_name_char(c))
            .map_or(r.len(), |i| i + 1);
        r = r[end..].trim_start();
    }
    Some(token)
}

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
            while j < bytes.len() && is_name_byte(bytes[j]) {
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
        assert_eq!(pragma_token("  // "), Some(""));
        assert_eq!(pragma_token("const x = 5"), None);
        assert_eq!(pragma_token("// see the #foo"), None);
    }

    #[test]
    fn hint_at_finds_the_hint_token() {
        let line = "    // #component #tag";
        assert_eq!(hint_at(line, 10).map(|(n, ..)| n), Some("#component"));
        assert_eq!(hint_at(line, 6), None);
        assert_eq!(hint_at("// plain comment", 5), None);
    }

    #[test]
    fn component_tag_at_finds_open_close_and_selfclose() {
        let t = "x = tpl`<todo-item :a=${1}>`";
        let off = t.find("todo").unwrap() + 2;
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        let t = "x = tpl`</todo-item>`";
        let off = t.find("todo").unwrap() + 1;
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        let t = "x = tpl`<todo-item />`";
        let off = t.find("item").unwrap();
        assert_eq!(
            component_tag_at(t, off).map(|(tag, ..)| tag),
            Some("todo-item".to_string())
        );
        let t = "x = tpl`<todo-item  :a=${1}>`";
        let off = t.find(":a").unwrap();
        assert_eq!(component_tag_at(t, off), None);
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
        match component_props_type("Card", "class Card extends Component<{ x: number }> {}") {
            PropsExtract::Type(t) => assert_eq!(t, "props: { x: number }"),
            _ => panic!("expected inline type"),
        }
        assert!(matches!(
            component_props_type("Bare", "class Bare extends Component {}"),
            PropsExtract::NoProps
        ));
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
        assert_eq!(tag_name_context("x = tpl`<div ", 13), None);
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

#[cfg(test)]
mod prop {
    use super::*;

    proptest::proptest! {
        #![proptest_config(proptest::prelude::ProptestConfig { cases: 2048, ..proptest::prelude::ProptestConfig::default() })]

        #[test]
        fn text_scanners_never_panic(
            text in "\\PC{0,300}",
            idx in 0usize..2048,
            line in 0u32..40,
            ch in 0u32..200,
        ) {
            let boundaries: Vec<usize> =
                (0..=text.len()).filter(|&i| text.is_char_boundary(i)).collect();
            let offset = boundaries[idx % boundaries.len()];
            let _ = offset_of(&text, line, ch);
            let _ = tag_context(&text, offset);
            let _ = tag_name_context(&text, offset);
            let _ = component_tag_at(&text, offset);
            let _ = token_start_char(&text, offset, ch);
            let _ = pragma_token(&text);
            let _ = line_before_cursor(&text, offset);
            if let Some(l) = line_text(&text, line) {
                let _ = hint_at(l, ch as usize);
                let _ = pragma_token(l);
            }
        }
    }
}
