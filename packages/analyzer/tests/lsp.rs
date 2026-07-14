//! End-to-end tests for the persistent LSP server (`elemix-analyzer --lsp`).
//! Each test spawns the built binary, speaks framed JSON-RPC over stdio against
//! the `fixtures-lsp` project, and asserts on the pushed diagnostics. The oracle
//! step needs the project's `tsc` (present after `pnpm install`), same as the CLI.

use serde_json::{json, Value};
use std::io::{BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::Duration;

fn fixtures_lsp() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures-lsp")
}

fn file_uri(path: &std::path::Path) -> String {
    format!("file://{}", path.to_string_lossy())
}

/// A tiny synchronous LSP client: a reader thread frames the server's stdout into
/// JSON messages on a channel; the test drives requests/notifications on stdin.
struct Client {
    child: Child,
    stdin: ChildStdin,
    rx: Receiver<Value>,
    next_id: i64,
}

impl Client {
    fn start(root: &std::path::Path) -> Client {
        let mut child = Command::new(env!("CARGO_BIN_EXE_elemix-analyzer"))
            .args(["--lsp", "--root", &root.to_string_lossy()])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn elemix-analyzer --lsp");

        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                // Read headers up to the blank line, pulling out Content-Length.
                let mut len = 0usize;
                let mut header = Vec::new();
                let mut byte = [0u8; 1];
                loop {
                    if reader.read_exact(&mut byte).is_err() {
                        return;
                    }
                    header.push(byte[0]);
                    if header.ends_with(b"\r\n\r\n") {
                        break;
                    }
                }
                for line in String::from_utf8_lossy(&header).lines() {
                    if let Some(v) = line.strip_prefix("Content-Length:") {
                        len = v.trim().parse().unwrap_or(0);
                    }
                }
                if len == 0 {
                    continue;
                }
                let mut body = vec![0u8; len];
                if reader.read_exact(&mut body).is_err() {
                    return;
                }
                if let Ok(v) = serde_json::from_slice::<Value>(&body) {
                    if tx.send(v).is_err() {
                        return;
                    }
                }
            }
        });

        Client {
            child,
            stdin,
            rx,
            next_id: 1,
        }
    }

    fn send(&mut self, msg: &Value) {
        let body = serde_json::to_vec(msg).unwrap();
        write!(self.stdin, "Content-Length: {}\r\n\r\n", body.len()).unwrap();
        self.stdin.write_all(&body).unwrap();
        self.stdin.flush().unwrap();
    }

    fn notify(&mut self, method: &str, params: Value) {
        self.send(&json!({ "jsonrpc": "2.0", "method": method, "params": params }));
    }

    /// Send a request and block for its matching-id response (draining any
    /// notifications that arrive first).
    fn request(&mut self, method: &str, params: Value) -> Value {
        let id = self.next_id;
        self.next_id += 1;
        self.send(&json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }));
        let deadline = Duration::from_secs(30);
        loop {
            let msg = self
                .rx
                .recv_timeout(deadline)
                .unwrap_or_else(|_| panic!("no response to {method}"));
            if msg.get("id").and_then(Value::as_i64) == Some(id) {
                return msg;
            }
        }
    }

    fn initialize(&mut self, root: &std::path::Path) -> Value {
        let uri = file_uri(root);
        let resp = self.request(
            "initialize",
            json!({
                "processId": null,
                "rootUri": uri,
                "capabilities": {},
                "workspaceFolders": [{ "uri": uri, "name": "fx" }],
            }),
        );
        self.notify("initialized", json!({}));
        resp
    }

    fn did_open(&mut self, uri: &str, text: &str) {
        self.notify(
            "textDocument/didOpen",
            json!({ "textDocument": { "uri": uri, "languageId": "typescript", "version": 1, "text": text } }),
        );
    }

    fn did_change(&mut self, uri: &str, text: &str) {
        self.notify(
            "textDocument/didChange",
            json!({ "textDocument": { "uri": uri, "version": 2 }, "contentChanges": [{ "text": text }] }),
        );
    }

    fn did_close(&mut self, uri: &str) {
        self.notify(
            "textDocument/didClose",
            json!({ "textDocument": { "uri": uri } }),
        );
    }

    /// Wait for the next `publishDiagnostics` whose uri ends with `suffix`;
    /// returns its `diagnostics` array.
    fn wait_publish(&self, suffix: &str) -> Vec<Value> {
        let deadline = Duration::from_secs(30);
        loop {
            let msg = self
                .rx
                .recv_timeout(deadline)
                .unwrap_or_else(|_| panic!("no publishDiagnostics for {suffix}"));
            if msg.get("method").and_then(Value::as_str) == Some("textDocument/publishDiagnostics")
            {
                let p = &msg["params"];
                if p["uri"].as_str().unwrap_or_default().ends_with(suffix) {
                    return p["diagnostics"].as_array().cloned().unwrap_or_default();
                }
            }
        }
    }

    fn shutdown(&mut self) {
        let _ = self.request("shutdown", Value::Null);
        self.notify("exit", Value::Null);
    }

    fn completion(&mut self, uri: &str, line: u32, character: u32) -> Vec<Value> {
        let resp = self.request(
            "textDocument/completion",
            json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character },
            }),
        );
        resp["result"].as_array().cloned().unwrap_or_default()
    }

    fn hover(&mut self, uri: &str, line: u32, character: u32) -> Value {
        let resp = self.request(
            "textDocument/hover",
            json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character },
            }),
        );
        resp["result"].clone()
    }

    fn code_action(&mut self, uri: &str, diag: &Value) -> Vec<Value> {
        let resp = self.request(
            "textDocument/codeAction",
            json!({
                "textDocument": { "uri": uri },
                "range": diag["range"],
                "context": { "diagnostics": [diag] },
            }),
        );
        resp["result"].as_array().cloned().unwrap_or_default()
    }

    fn pid(&self) -> u32 {
        self.child.id()
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

// --- content variants of the (clean) app.ts buffer ---------------------------

fn clean() -> String {
    std::fs::read_to_string(fixtures_lsp().join("app.ts")).expect("read app.ts")
}

fn bad_prop() -> String {
    clean().replace(":count=${1}", ":count=${'nope'}")
}

fn bad_hint() -> String {
    clean().replace("    template =", "    // #bogushint\n    template =")
}

/// Replace the usage with `<user-card ATTRS></user-card>` and return the buffer
/// plus the (line, character) of the cursor at the END of the open tag (right
/// before `>`), so any bound attrs precede the cursor.
/// The 0-based (line, UTF-16 character) of a byte offset in `text`.
fn line_col(text: &str, byte: usize) -> (u32, u32) {
    let prefix = &text[..byte];
    let line = prefix.matches('\n').count() as u32;
    let col_start = prefix.rfind('\n').map(|n| n + 1).unwrap_or(0);
    let character = prefix[col_start..]
        .chars()
        .map(|c| c.len_utf16() as u32)
        .sum();
    (line, character)
}

fn card_usage(attrs: &str) -> (String, u32, u32) {
    let content = clean().replace(
        "tpl`<user-card :name=${'Ada'} :count=${1}></user-card>`",
        &format!("tpl`<user-card {attrs}></user-card>`"),
    );
    // The open tag's '>' is the one in "></user-card>"; cursor sits just before it.
    let idx = content.find("></user-card>").unwrap();
    let (line, character) = line_col(&content, idx);
    (content, line, character)
}

/// Swap the usage for an arbitrary `<…>` template; the cursor is placed just after
/// `marker`.
fn at_marker(inner: &str, marker: &str) -> (String, u32, u32) {
    let content = clean().replace(
        "tpl`<user-card :name=${'Ada'} :count=${1}></user-card>`",
        &format!("tpl`{inner}`"),
    );
    let idx = content.find(marker).unwrap() + marker.len();
    let (line, character) = line_col(&content, idx);
    (content, line, character)
}

// --- tests -------------------------------------------------------------------

#[test]
fn initialize_reports_full_text_sync() {
    let root = fixtures_lsp();
    let mut c = Client::start(&root);
    let resp = c.initialize(&root);
    // TextDocumentSyncKind::FULL == 1.
    assert_eq!(
        resp["result"]["capabilities"]["textDocumentSync"], 1,
        "server must advertise FULL text sync: {resp}"
    );
    c.shutdown();
}

#[test]
fn open_bad_prop_publishes_then_fix_clears() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let mut c = Client::start(&root);
    c.initialize(&root);

    // Opening a bad `:count` (string into number) must surface a tsc error.
    c.did_open(&app, &bad_prop());
    let diags = c.wait_publish("app.ts");
    assert!(!diags.is_empty(), "expected a diagnostic for the bad prop");
    let d = &diags[0];
    assert_eq!(
        d["severity"], 1,
        "prop type error is an error, not a warning"
    );
    assert_eq!(d["source"], "elemix-analyzer");
    assert!(
        d["code"].as_str().unwrap_or_default().starts_with("TS"),
        "prop error carries a TS#### code: {d}"
    );
    let msg = d["message"].as_str().unwrap_or_default();
    assert!(
        msg.contains("count") && msg.contains("<user-card>"),
        "message names the offending prop + tag: {msg}"
    );

    // Fixing it must clear (an empty publish for the same file).
    c.did_change(&app, &clean());
    let diags = c.wait_publish("app.ts");
    assert!(
        diags.is_empty(),
        "fix should clear diagnostics, got: {diags:?}"
    );
    c.shutdown();
}

#[test]
fn duplicate_prop_is_flagged() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // Bind `:name` twice on the same element - each is individually valid, so only
    // the pure-Rust duplicate check catches it.
    let content = clean().replace(":name=${'Ada'}", ":name=${'Ada'} :name=${'Bob'}");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let diags = c.wait_publish("app.ts");
    let dup = diags
        .iter()
        .find(|d| {
            d["message"]
                .as_str()
                .unwrap_or_default()
                .contains("duplicated prop")
        })
        .unwrap_or_else(|| panic!("expected a duplicate-prop diagnostic, got: {diags:?}"));
    assert_eq!(dup["severity"], 1, "duplicate prop is an error");
    assert!(
        dup["message"].as_str().unwrap().contains("'name'"),
        "names the offending prop: {dup}"
    );
    c.shutdown();
}

#[test]
fn bad_hint_carets_the_member() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let src = bad_hint();
    let mut c = Client::start(&root);
    c.initialize(&root);

    c.did_open(&app, &src);
    let diags = c.wait_publish("app.ts");
    let hint = diags
        .iter()
        .find(|d| {
            d["message"]
                .as_str()
                .unwrap_or_default()
                .contains("bogushint")
        })
        .unwrap_or_else(|| panic!("expected a #bogushint diagnostic, got: {diags:?}"));
    assert_eq!(hint["severity"], 1);
    // It must caret the member the hint sits on (the `template` field), NOT line 1.
    let line = hint["range"]["start"]["line"].as_u64().unwrap();
    let member_line = src.lines().position(|l| l.contains("template =")).unwrap() as u64;
    assert_eq!(line, member_line, "hint must caret the member line");
    c.shutdown();
}

#[test]
fn close_reverts_to_disk_content() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let mut c = Client::start(&root);
    c.initialize(&root);

    c.did_open(&app, &bad_prop());
    assert!(!c.wait_publish("app.ts").is_empty(), "bad buffer flags");

    // Closing drops the in-memory buffer; disk (clean) is re-read → cleared.
    c.did_close(&app);
    assert!(
        c.wait_publish("app.ts").is_empty(),
        "closing reverts to the clean on-disk file"
    );
    c.shutdown();
}

#[test]
fn unknown_notification_is_ignored() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let mut c = Client::start(&root);
    c.initialize(&root);

    // A method the server doesn't handle must not wedge it.
    c.notify("$/somethingUnknown", json!({ "whatever": true }));
    c.did_open(&app, &bad_prop());
    assert!(
        !c.wait_publish("app.ts").is_empty(),
        "server still analyzes after an unknown notification"
    );
    c.shutdown();
}

#[test]
fn prop_completion_offers_component_props() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // No props bound yet: completion should offer the whole set.
    let (content, line, character) = card_usage("");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let items = c.completion(&app, line, character);
    let labels: Vec<&str> = items.iter().filter_map(|i| i["label"].as_str()).collect();
    assert!(labels.contains(&":name"), "offers :name, got {labels:?}");
    assert!(labels.contains(&":count"), "offers :count, got {labels:?}");
    // Enumerated as required (Props has no `?`), and inserted as a snippet hole.
    let name = items.iter().find(|i| i["label"] == ":name").unwrap();
    assert_eq!(name["detail"], "required prop");
    assert_eq!(name["textEdit"]["newText"], ":name=\\${$1}");
    c.shutdown();
}

#[test]
fn prop_completion_after_typing_colon_replaces_the_colon() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // The user has already typed the trigger `:`.
    let (content, line, character) = card_usage(":");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let items = c.completion(&app, line, character);
    let name = items
        .iter()
        .find(|i| i["label"] == ":name")
        .expect("offers :name");
    // The edit must cover the typed `:` (start one char back), so accepting yields
    // `:name=…`, NOT `::name=…`.
    let edit = &name["textEdit"];
    assert_eq!(edit["range"]["start"]["line"], line);
    assert_eq!(edit["range"]["start"]["character"], character - 1);
    assert_eq!(edit["range"]["end"]["character"], character);
    assert_eq!(edit["newText"], ":name=\\${$1}");
    c.shutdown();
}

#[test]
fn prop_completion_skips_already_bound_props() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // `:name` already bound → only `:count` should be offered.
    let (content, line, character) = card_usage(":name=${'Ada'} ");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let labels: Vec<String> = c
        .completion(&app, line, character)
        .iter()
        .filter_map(|i| i["label"].as_str().map(str::to_string))
        .collect();
    assert!(
        labels.contains(&":count".to_string()),
        "offers :count: {labels:?}"
    );
    assert!(
        !labels.contains(&":name".to_string()),
        "skips bound :name: {labels:?}"
    );
    c.shutdown();
}

#[test]
fn prop_completion_works_after_an_arrow_binding() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // A prior binding whose value contains a `=>` arrow (and thus a `>`): the tag
    // scanner must NOT mistake that for the tag close. Cursor is after it.
    let (content, line, character) = card_usage(":name=${() => 'Ada'} ");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let labels: Vec<String> = c
        .completion(&app, line, character)
        .iter()
        .filter_map(|i| i["label"].as_str().map(str::to_string))
        .collect();
    assert!(
        labels.contains(&":count".to_string()),
        "completion works past an arrow binding: {labels:?}"
    );
    assert!(
        !labels.contains(&":name".to_string()),
        "the bound :name is still skipped: {labels:?}"
    );
    c.shutdown();
}

#[test]
fn prop_completion_excludes_props_bound_after_the_cursor() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // `:count` is bound LATER in the same tag; the cursor sits before it. Listing
    // only unused props must not depend on caret position, so `:count` is excluded
    // and only `:name` remains offerable.
    let (content, line, character) =
        at_marker("<user-card :count=${1}></user-card>", "<user-card ");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let labels: Vec<String> = c
        .completion(&app, line, character)
        .iter()
        .filter_map(|i| i["label"].as_str().map(str::to_string))
        .collect();
    assert!(
        labels.contains(&":name".to_string()),
        "offers the unbound :name: {labels:?}"
    );
    assert!(
        !labels.contains(&":count".to_string()),
        "excludes :count bound later in the tag: {labels:?}"
    );
    c.shutdown();
}

#[test]
fn tag_completion_offers_components_with_required_prop_holes() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // Typing `<` in a template: offer registered component tags. (Marker is
    // `tpl`<` so we land in the template, not the `<user-card>` in a comment.)
    let (content, line, character) = at_marker("<", "tpl`<");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let items = c.completion(&app, line, character);
    let labels: Vec<&str> = items.iter().filter_map(|i| i["label"].as_str()).collect();
    assert!(labels.contains(&"user-card"), "offers the tag: {labels:?}");
    // user-card's props (name, count) are required → self-closed with holes, caret
    // in the first. my-app has no props → bare self-closed.
    let uc = items.iter().find(|i| i["label"] == "user-card").unwrap();
    assert_eq!(
        uc["textEdit"]["newText"],
        "user-card :name=\\${$1} :count=\\${$2} />"
    );
    let app_item = items.iter().find(|i| i["label"] == "my-app").unwrap();
    assert_eq!(app_item["textEdit"]["newText"], "my-app />");
    c.shutdown();
}

#[test]
fn event_binding_completes_inside_any_tag() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // A native <div> (not a component): bindings apply to any element.
    let (content, line, character) = at_marker("<div @></div>", "<div @");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let labels: Vec<String> = c
        .completion(&app, line, character)
        .iter()
        .filter_map(|i| i["label"].as_str().map(str::to_string))
        .collect();
    assert!(
        labels.contains(&"@click".to_string()),
        "offers @click inside a tag: {labels:?}"
    );
    c.shutdown();
}

#[test]
fn bindings_do_not_complete_in_text_content() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // Cursor in TEXT between tags - not a bindable position. This is the bug:
    // @event/~model used to complete anywhere in the template.
    let (content, line, character) = at_marker("<div>plain text</div>", "plain text");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    assert!(
        c.completion(&app, line, character).is_empty(),
        "no bindings offered in text content"
    );
    c.shutdown();
}

#[test]
fn compiler_hint_completion_on_a_comment_line() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // A partial `// #comp` hint comment.
    let content = clean().replace("// #component #tag my-app", "// #comp");
    let idx = content.find("// #comp").unwrap() + "// #comp".len();
    let (line, character) = line_col(&content, idx);
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let labels: Vec<String> = c
        .completion(&app, line, character)
        .iter()
        .filter_map(|i| i["label"].as_str().map(str::to_string))
        .collect();
    assert!(
        labels.contains(&"#component".to_string()),
        "offers #component: {labels:?}"
    );
    assert!(
        labels.contains(&"#tag".to_string()),
        "offers #tag: {labels:?}"
    );
    c.shutdown();
}

#[test]
fn hover_shows_compiler_hint_docs() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let content = clean(); // has `// #component #tag my-app`
    let idx = content.find("#component").unwrap() + 2; // a char inside `#component`
    let (line, character) = line_col(&content, idx);
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let hover = c.hover(&app, line, character);
    let value = hover["contents"]["value"].as_str().unwrap_or_default();
    assert!(
        value.contains("#component"),
        "hover names the hint: {value:?}"
    );
    assert!(
        value.contains("custom element"),
        "hover carries the doc: {value:?}"
    );
    c.shutdown();
}

#[test]
fn hover_on_a_component_tag_shows_its_props_type() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let content = clean(); // uses `<user-card …>`; card.ts declares `type Props`
                           // Target the real tag in the tpl (the file comment also mentions the tag).
    let idx = content.find("<user-card :name").unwrap() + 3; // inside the tag name
    let (line, character) = line_col(&content, idx);
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let hover = c.hover(&app, line, character);
    let value = hover["contents"]["value"].as_str().unwrap_or_default();
    assert!(
        value.contains("user-card"),
        "hover names the component: {value:?}"
    );
    assert!(
        value.contains("name: string") && value.contains("count: number"),
        "hover shows the props type: {value:?}"
    );
    c.shutdown();
}

#[test]
fn completion_outside_a_tag_returns_nothing() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &clean());
    // Line 0 col 0 is in the import block - not a tag.
    assert!(
        c.completion(&app, 0, 0).is_empty(),
        "no completions outside a tag"
    );
    c.shutdown();
}

#[test]
fn unimported_component_offers_auto_import_quick_fix() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    // Drop the `import './card';` but keep the <user-card> usage → unimported warning.
    let content = clean().replace("import './card';\n", "");
    let mut c = Client::start(&root);
    c.initialize(&root);
    c.did_open(&app, &content);
    let diags = c.wait_publish("app.ts");
    let warn = diags
        .iter()
        .find(|d| d["code"] == "import")
        .unwrap_or_else(|| panic!("expected an unimported-component warning: {diags:?}"));

    let actions = c.code_action(&app, warn);
    let fix = actions
        .iter()
        .find(|a| a["title"].as_str().unwrap_or_default().contains("Import"))
        .unwrap_or_else(|| panic!("expected an Import quick-fix: {actions:?}"));
    assert!(fix["title"].as_str().unwrap().contains("user-card"));
    // Inserts a side-effect import for the card module.
    let edits = fix["edit"]["changes"][app.as_str()].as_array().unwrap();
    let new_text = edits[0]["newText"].as_str().unwrap();
    assert!(
        new_text.contains("import './card';"),
        "inserts the card import: {new_text}"
    );
    c.shutdown();
}

#[test]
fn shutdown_exits_cleanly_and_leaves_no_cache() {
    let root = fixtures_lsp();
    let app = file_uri(&root.join("app.ts"));
    let mut c = Client::start(&root);
    let pid = c.pid();
    c.initialize(&root);
    c.did_open(&app, &bad_prop());
    c.wait_publish("app.ts");

    // Graceful shutdown: shutdown request, then exit notification.
    let _ = c.request("shutdown", Value::Null);
    c.notify("exit", Value::Null);

    // This process's overlay dir must be gone (it's cleaned each run + on exit).
    let pid_cache = root
        .join("node_modules/.cache/elemix-analyzer")
        .join(pid.to_string());
    // Give the server a moment to finish its final cleanup, then assert.
    for _ in 0..50 {
        if !pid_cache.exists() {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    assert!(
        !pid_cache.exists(),
        "overlay cache dir must not survive: {}",
        pid_cache.display()
    );
    // And nothing ever lands beside the sources.
    let strays: Vec<_> = std::fs::read_dir(&root)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let n = e.file_name();
            let n = n.to_string_lossy();
            n.contains("__elemix") || (n.starts_with('.') && n.ends_with(".ts"))
        })
        .collect();
    assert!(
        strays.is_empty(),
        "no overlay files beside sources: {strays:?}"
    );
}
