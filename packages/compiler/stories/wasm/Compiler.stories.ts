import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import init, { compile } from '../../pkg/elemix_compiler.js';
import wasmUrl from '../../pkg/elemix_compiler_bg.wasm?url';

// A real elemix component, compiled in the browser by the wasm build.
const SOURCE = [
    "import { Component, tpl } from '@neuralfog/elemix';",
    '// #component',
    'export class CounterApp extends Component {',
    '    // #state',
    '    state: { count: number } = { count: 0 };',
    '    increment = () => { this.state.count++; };',
    '    template = () => tpl`<button @click=${this.increment}>count is ${this.state.count}</button>`;',
    '}',
].join('\n');

let ready = false;
const ensureWasm = async () => {
    if (!ready) {
        await init({ module_or_path: wasmUrl });
        ready = true;
    }
};

export default { title: 'Wasm/Compiler' };

export const CompilesInBrowser = {
    render: () =>
        '<pre data-testid="wasm-out" style="margin:0;padding:16px;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;background:#0d1117;color:#c9d1d9;border-radius:8px">compiling in the browser…</pre>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        await ensureWasm();
        const out = compile(SOURCE);

        // Show the compiled output live in the story.
        const pre = find('[data-testid="wasm-out"]', canvasElement);
        if (pre) pre.textContent = out;

        // The wasm compiler ran in-browser and lowered the template:
        expect(out).toContain("from '@neuralfog/elemix/runtime'");
        expect(out).toContain('view()');
        // ...the `tpl` tag is erased and its import stripped:
        expect(out).not.toContain('tpl`');
        expect(out).not.toContain('/directives');
    },
};
