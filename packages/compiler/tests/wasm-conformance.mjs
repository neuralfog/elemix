// Conformance: the wasm build must produce byte-identical output to native.
// Compiles every fixture through the wasm `pkg` and checks each result against
// the committed insta snapshots (which ARE native `compile()` output), so
// wasm == snapshot ⟹ wasm == native. Run: node tests/wasm-conformance.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import init, { compile } from '../pkg/elemix_compiler.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await init({ module_or_path: readFileSync(join(root, 'pkg/elemix_compiler_bg.wasm')) });

const fixturesDir = join(root, 'tests/fixtures');
const snapsDir = join(root, 'tests/snapshots');

// Strip the insta YAML header (everything up to and including the closing `---`).
const snapshotBody = (file) => {
    const text = readFileSync(file, 'utf8');
    return text.slice(text.indexOf('\n---\n') + 5);
};

const fixtures = readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.ts'))
    .sort();

const fails = [];
for (const f of fixtures) {
    const got = compile(readFileSync(join(fixturesDir, f), 'utf8'));
    const want = snapshotBody(
        join(snapsDir, `snapshots__fixtures_compile_to_their_snapshots@${f}.snap`),
    );
    if (got.trimEnd() !== want.trimEnd()) fails.push(f);
}

console.log(
    `wasm conformance: ${fixtures.length - fails.length}/${fixtures.length} match native`,
);
if (fails.length) {
    console.error(`MISMATCH: ${fails.join(', ')}`);
    process.exit(1);
}
