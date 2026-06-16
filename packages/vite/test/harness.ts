import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// The locally-built compiler binary (has `--stdin --sourcemap`). The published
// dependency picks it up once a native build ships; the test script builds it.
export const BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../compiler/target/debug/elemix-compiler',
);

// A Source Map v3 object (only the fields the tests touch are typed).
export interface SourceMap {
    version: 3;
    sources: string[];
    sourcesContent?: string[];
    mappings: string;
    [key: string]: unknown;
}

export interface TransformResult {
    code: string;
    map: SourceMap;
}

type TransformFn = (
    this: unknown,
    code: string,
    id: string,
) => Promise<TransformResult | null>;

// transform may be a function or an { handler } object hook — normalize + call.
export const runTransform = (plugin: Plugin, code: string, id: string) => {
    const hook = plugin.transform;
    const fn = (
        typeof hook === 'function' ? hook : hook?.handler
    ) as TransformFn;
    return fn.call({}, code, id);
};

// A `tpl` component with a verbatim `increment` method — its `this.state.count++`
// line exists identically in the original and the compiled output, so its origin
// through the map chain is unambiguous.
export const COUNTER_SOURCE = [
    "import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';",
    'export class CounterApp extends Component {',
    '    state = state({ count: 0 });',
    '    increment = () => { this.state.count++; };',
    '    template = () => tpl`<button @click=${this.increment}>${this.state.count}</button>`;',
    '}',
    "defineComponent('counter-app', CounterApp);",
].join('\n');

export const COUNTER_ID = '/src/CounterApp.ts';
