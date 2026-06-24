#!/usr/bin/env node
// The TypeOracle's node half: type-check the analyzer's virtual overlays with
// the PROJECT'S OWN `typescript`, so verdicts match what the user's editor shows.
//
// Type judgment is the one step the Rust/oxc side can't do (no checker). The Rust
// binary owns everything else — template scan, spans, overlay codegen, reporting;
// this script only answers "type-check these files (some served from memory) and
// hand back the semantic diagnostics".
//
//   request : { root, overlays: [{ path, content }], check: [path, …] }
//   response: { ok: true,  diagnostics: [{ file, start, length, code, category, message }] }
//           | { ok: false, error }
import { createRequire } from 'node:module';

const read = async () => {
    let input = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) input += chunk;
    return JSON.parse(input);
};

const fail = (error) => {
    process.stdout.write(JSON.stringify({ ok: false, error }));
    process.exit(0);
};

const norm = (p) => p.replace(/\\/g, '/');

const req = await read();

// Resolve the project's TypeScript — NOT a global. Its verdicts must agree with
// the user's IDE, which runs this exact version.
const root = req.root.endsWith('/') ? req.root : `${req.root}/`;
let ts;
try {
    ts = createRequire(root)('typescript');
} catch {
    fail(
        `could not resolve 'typescript' from ${req.root} — is it installed in the project's node_modules?`,
    );
}

// Project compilerOptions (strict, paths, lib, …) from the nearest tsconfig, so
// the check runs under the same rules as the build. Fall back to sane defaults.
let options = { strict: true, skipLibCheck: true, noEmit: true };
const configPath = ts.findConfigFile(req.root, ts.sys.fileExists, 'tsconfig.json');
if (configPath) {
    const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!cfg.error) {
        const parsed = ts.parseJsonConfigFileContent(
            cfg.config,
            ts.sys,
            norm(configPath.replace(/\/tsconfig\.json$/, '')),
        );
        options = { ...parsed.options, noEmit: true };
    }
}

const overlays = new Map(req.overlays.map((o) => [norm(o.path), o.content]));

// A host that serves the overlay files from memory and everything else from
// disk — the overlays exist only for tsc, never on the user's filesystem.
const host = ts.createCompilerHost(options, true);
const baseGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const overlaid = overlays.get(norm(fileName));
    if (overlaid !== undefined) {
        return ts.createSourceFile(fileName, overlaid, languageVersion, true);
    }
    return baseGetSourceFile(fileName, languageVersion, onError, shouldCreate);
};
const baseReadFile = host.readFile.bind(host);
host.readFile = (fileName) => overlays.get(norm(fileName)) ?? baseReadFile(fileName);
const baseFileExists = host.fileExists.bind(host);
host.fileExists = (fileName) => overlays.has(norm(fileName)) || baseFileExists(fileName);

const program = ts.createProgram({ rootNames: req.check, options, host });

const diagnostics = [];
for (const file of req.check) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    for (const d of program.getSemanticDiagnostics(sourceFile)) {
        if (!d.file) continue;
        // tsc positions are UTF-16 code-unit offsets; the Rust side keys holes by
        // UTF-8 byte offset (oxc spans). Convert here so attribution is exact even
        // when the file has multi-byte characters.
        const utf16 = d.start ?? 0;
        diagnostics.push({
            file: norm(d.file.fileName),
            start: Buffer.byteLength(d.file.text.slice(0, utf16), 'utf8'),
            code: d.code,
            category: ts.DiagnosticCategory[d.category].toLowerCase(),
            message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        });
    }
}

process.stdout.write(JSON.stringify({ ok: true, diagnostics }));
