import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    type LanguageClientOptions,
    type ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

// ── template formatter (`etf`) integration ─────────────────────────────────

type EtfDiagnostic = {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    severity: string;
    message: string;
    edit: string;
};

// Resolve the `etf` binary: an explicit setting, else the project's installed
// launcher, else `etf` on PATH.
const resolveBin = (scope?: vscode.Uri): string => {
    const cfg = vscode.workspace.getConfiguration('elemix', scope);
    const custom = cfg.get<string>('formatter.path')?.trim();
    if (custom) return custom;

    const folder = scope
        ? vscode.workspace.getWorkspaceFolder(scope)
        : vscode.workspace.workspaceFolders?.[0];
    if (folder) {
        const local = path.join(
            folder.uri.fsPath,
            'node_modules',
            '.bin',
            process.platform === 'win32' ? 'etf.cmd' : 'etf',
        );
        if (fs.existsSync(local)) return local;
    }
    return 'etf';
};

// The project root `etf` reads `elemix.toml` from - width and indent live there,
// not in editor settings. Passed as `--root`; empty when there's no folder.
const rootArgs = (document: vscode.TextDocument): string[] => {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return folder ? ['--root', folder.uri.fsPath] : [];
};

// Pipe `input` through `etf` and hand back stdout, or null if the binary is
// missing or fails.
const runEtf = (
    bin: string,
    args: string[],
    input: string,
): Promise<string | null> =>
    new Promise((resolve) => {
        const child = spawn(bin, args);
        let out = '';
        child.stdout.on('data', (chunk) => {
            out += chunk;
        });
        child.on('error', () => resolve(null));
        child.on('close', (code) => resolve(code === 0 ? out : null));
        child.stdin.on('error', () => resolve(null));
        child.stdin.end(input);
    });

const diagnostics = vscode.languages.createDiagnosticCollection('elemix');
// Per-document fix edits, keyed by URI - used by the quick-fix code action.
const fixes = new Map<string, Array<{ range: vscode.Range; edit: string }>>();
// Whether an `etf` binary is reachable. Gates every formatting feature - the
// commands, diagnostics, quick-fix, and format-on-save - and their palette entries.
let etfAvailable = false;

// Run `etf --lsp` and turn its JSON into ranges + fix edits.
const templateEdits = async (
    document: vscode.TextDocument,
): Promise<Array<{ range: vscode.Range; message: string; edit: string }>> => {
    if (document.languageId !== 'typescript') return [];
    const out = await runEtf(
        resolveBin(document.uri),
        ['--lsp', ...rootArgs(document)],
        document.getText(),
    );
    if (out === null) return [];
    let parsed: EtfDiagnostic[];
    try {
        parsed = JSON.parse(out);
    } catch {
        return [];
    }
    return parsed.map((d) => ({
        range: new vscode.Range(
            d.range.start.line,
            d.range.start.character,
            d.range.end.line,
            d.range.end.character,
        ),
        message: d.message,
        edit: d.edit,
    }));
};

const refreshDiagnostics = async (
    document: vscode.TextDocument,
): Promise<void> => {
    if (document.languageId !== 'typescript' || !etfAvailable) return;
    const items = await templateEdits(document);
    diagnostics.set(
        document.uri,
        items.map((it) => {
            const diag = new vscode.Diagnostic(
                it.range,
                it.message,
                vscode.DiagnosticSeverity.Warning,
            );
            diag.source = 'elemix';
            return diag;
        }),
    );
    fixes.set(
        document.uri.toString(),
        items.map((it) => ({ range: it.range, edit: it.edit })),
    );
};

const codeActionProvider: vscode.CodeActionProvider = {
    provideCodeActions(document, range) {
        const entries = fixes.get(document.uri.toString()) ?? [];
        const actions: vscode.CodeAction[] = [];
        for (const e of entries) {
            if (!e.range.intersection(range)) continue;
            const action = new vscode.CodeAction(
                'Format template',
                vscode.CodeActionKind.QuickFix,
            );
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, e.range, e.edit);
            actions.push(action);
        }
        return actions;
    },
};

// On save, delegate the whole decision to `etf --stdin --on-save`: it formats
// only when the project's `elemix.toml` has `[formatter] format_on_save = true`
// (and the formatter enabled), else it echoes the buffer back unchanged. So
// format-on-save is controlled by elemix.toml, not editor settings.
const saveEdits = async (
    document: vscode.TextDocument,
): Promise<vscode.TextEdit[]> => {
    const source = document.getText();
    const out = await runEtf(
        resolveBin(document.uri),
        ['--stdin', '--on-save', ...rootArgs(document)],
        source,
    );
    if (out === null || out === source) return [];
    const full = new vscode.Range(
        document.positionAt(0),
        document.positionAt(source.length),
    );
    return [vscode.TextEdit.replace(full, out)];
};

const formatTemplates = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== 'typescript') return;
    const document = editor.document;
    const source = document.getText();
    const out = await runEtf(
        resolveBin(document.uri),
        ['--stdin', ...rootArgs(document)],
        source,
    );
    if (out === null) {
        vscode.window.showWarningMessage(
            'elemix: could not run the template formatter (etf).',
        );
        return;
    }
    if (out === source) return;
    const full = new vscode.Range(
        document.positionAt(0),
        document.positionAt(source.length),
    );
    await editor.edit((builder) => builder.replace(full, out));
};

// Probe whether `etf` can run, publish it as a `when`-clause context key, and
// (dis)engage diagnostics accordingly. Re-run when the active file, workspace
// folders, or the configured path changes.
const refreshEtfAvailability = async (): Promise<void> => {
    const scope =
        vscode.window.activeTextEditor?.document.uri ??
        vscode.workspace.workspaceFolders?.[0]?.uri;
    const available = (await runEtf(resolveBin(scope), ['--lsp'], '')) !== null;
    const changed = available !== etfAvailable;
    etfAvailable = available;
    void vscode.commands.executeCommand(
        'setContext',
        'elemix.formatterAvailable',
        available,
    );
    if (!changed) return;
    if (available) {
        for (const doc of vscode.workspace.textDocuments) {
            void refreshDiagnostics(doc);
        }
    } else {
        diagnostics.clear();
        fixes.clear();
    }
};

// ── analyzer LSP (`ea --lsp`) integration ──────────────────────────────────

// One persistent analyzer server per workspace folder, each rooted at its folder.
const analyzerClients = new Map<string, LanguageClient>();

// Resolve the `ea` binary for a folder: an explicit setting, else the project's
// installed launcher. Returns null when neither is present - the analyzer is a
// project tool, so (unlike a global formatter) we never guess a PATH binary, and
// the server simply stays off.
const resolveAnalyzerBin = (folder: vscode.WorkspaceFolder): string | null => {
    const cfg = vscode.workspace.getConfiguration('elemix', folder.uri);
    const custom = cfg.get<string>('analyzer.path')?.trim();
    if (custom) return custom;

    const local = path.join(
        folder.uri.fsPath,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'ea.cmd' : 'ea',
    );
    return fs.existsSync(local) ? local : null;
};

const startAnalyzer = async (folder: vscode.WorkspaceFolder): Promise<void> => {
    const key = folder.uri.toString();
    if (analyzerClients.has(key)) return;
    const bin = resolveAnalyzerBin(folder);
    if (!bin) return;

    const serverOptions: ServerOptions = {
        command: bin,
        args: ['--lsp', '--root', folder.uri.fsPath],
        transport: TransportKind.stdio,
        options: { cwd: folder.uri.fsPath },
    };
    const clientOptions: LanguageClientOptions = {
        // Only the folder's own TypeScript files - keeps multi-root folders on
        // their own server.
        documentSelector: [
            {
                scheme: 'file',
                language: 'typescript',
                pattern: `${folder.uri.fsPath}/**/*`,
            },
        ],
        workspaceFolder: folder,
        diagnosticCollectionName: 'elemix-analyzer',
    };

    const client = new LanguageClient(
        'elemixAnalyzer',
        'elemix analyzer',
        serverOptions,
        clientOptions,
    );
    // Register eagerly so a concurrent start() call is a no-op, then roll back if
    // the server can't be launched (missing tsc, bad binary) - staying silent.
    analyzerClients.set(key, client);
    try {
        await client.start();
    } catch {
        analyzerClients.delete(key);
        void client.stop().catch(() => {});
    }
};

const stopAnalyzer = async (folder: vscode.WorkspaceFolder): Promise<void> => {
    const key = folder.uri.toString();
    const client = analyzerClients.get(key);
    if (!client) return;
    analyzerClients.delete(key);
    await client.stop().catch(() => {});
};

const startAllAnalyzers = (): void => {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        void startAnalyzer(folder);
    }
};

const restartAllAnalyzers = async (): Promise<void> => {
    const folders = [...analyzerClients.keys()];
    await Promise.all(
        (vscode.workspace.workspaceFolders ?? [])
            .filter((f) => folders.includes(f.uri.toString()))
            .map((f) => stopAnalyzer(f)),
    );
    startAllAnalyzers();
};

const stopAllAnalyzers = async (): Promise<void> => {
    const clients = [...analyzerClients.values()];
    analyzerClients.clear();
    await Promise.all(clients.map((c) => c.stop().catch(() => {})));
};

// Command: tear down every analyzer server and start fresh - picks up a rebuilt
// binary or a changed config without reloading the window.
const restartAnalyzer = async (): Promise<void> => {
    await stopAllAnalyzers();
    startAllAnalyzers();
    vscode.window.showInformationMessage('elemix: analyzer LSP restarted');
};

const debounce = new Map<string, ReturnType<typeof setTimeout>>();

export function activate(context: vscode.ExtensionContext): void {
    void refreshEtfAvailability();
    startAllAnalyzers();
    context.subscriptions.push(
        diagnostics,
        vscode.languages.registerCodeActionsProvider(
            'typescript',
            codeActionProvider,
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
        ),
        vscode.commands.registerCommand(
            'elemix.restartAnalyzer',
            restartAnalyzer,
        ),
        vscode.commands.registerCommand(
            'elemix.formatTemplates',
            formatTemplates,
        ),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('elemix.formatter.path')) {
                void refreshEtfAvailability();
            }
            if (e.affectsConfiguration('elemix.analyzer.path')) {
                void restartAllAnalyzers();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            void refreshEtfAvailability();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            void refreshEtfAvailability();
            for (const folder of e.added) void startAnalyzer(folder);
            for (const folder of e.removed) void stopAnalyzer(folder);
        }),
        vscode.workspace.onWillSaveTextDocument((event) => {
            const document = event.document;
            if (document.languageId !== 'typescript') return;
            if (!etfAvailable) return;
            // etf honours elemix.toml's format_on_save; nothing to gate here.
            event.waitUntil(saveEdits(document));
        }),
        vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
        vscode.workspace.onDidSaveTextDocument(refreshDiagnostics),
        vscode.workspace.onDidChangeTextDocument((e) => {
            const key = e.document.uri.toString();
            clearTimeout(debounce.get(key));
            debounce.set(
                key,
                setTimeout(() => refreshDiagnostics(e.document), 400),
            );
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            diagnostics.delete(doc.uri);
            fixes.delete(doc.uri.toString());
        }),
    );
}

export function deactivate(): Thenable<void> {
    return stopAllAnalyzers();
}
