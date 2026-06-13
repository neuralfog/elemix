// Robustness: the playground feeds half-typed source on every keystroke. Each
// malformed input must either return a string or throw a CATCHABLE JS error —
// never hard-crash — and the module must stay usable afterward (a known-good
// compile still works). Run: node tests/wasm-robustness.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import init, { compile } from '../pkg/elemix_compiler.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await init({ module_or_path: readFileSync(join(root, 'pkg/elemix_compiler_bg.wasm')) });

const GOOD = [
    "import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';",
    'export class CounterApp extends Component {',
    '    state = state({ count: 0 });',
    '    template = () => tpl`<button @click=${this.inc}>${this.state.count}</button>`;',
    '}',
    "defineComponent('counter-app', CounterApp);",
].join('\n');

const MALFORMED = [
    ['empty', ''],
    ['whitespace', '   \n  '],
    ['garbage', '🤖 не код $%^&*('],
    ['incomplete const', 'const x = '],
    ['unterminated template', 'class X extends Component { template = () => tpl`<div>'],
    ['unbalanced interp', 'tpl`${'],
    ['empty interp', 'class X extends Component { template = () => tpl`<div>${this.}</div>`; }'],
    ['malformed attr', 'export class X extends Component { template = () => tpl`<a ${>`; }'],
    ['half component', 'export class X extends Component {'],
    ['nested unbalanced', 'class X extends Component { template = () => tpl`<ul>${repeat(items, (i) => tpl`<li>${'],
];

let returned = 0;
let threw = 0;
let survived = 0;
for (const [name, src] of MALFORMED) {
    let outcome;
    try {
        const out = compile(src);
        outcome = `returned (${out.length} chars)`;
        returned++;
    } catch (e) {
        outcome = `threw (caught): ${String(e.message ?? e).slice(0, 50)}`;
        threw++;
    }
    let ok = false;
    try {
        ok = compile(GOOD).includes('view()');
    } catch {
        /* module poisoned */
    }
    if (ok) survived++;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(22)} ${outcome}`);
}

console.log(
    `\n${MALFORMED.length} inputs: ${returned} returned, ${threw} threw (caught) — module survived ${survived}/${MALFORMED.length}`,
);
if (survived !== MALFORMED.length) {
    console.error('FAIL: module did not survive every malformed input');
    process.exit(1);
}
console.log('OK: no hard crash, module usable after every input');
