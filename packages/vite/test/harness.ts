import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../compiler/target/debug/elemix-compiler',
);

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

export const runTransform = (plugin: Plugin, code: string, id: string) => {
    const hook = plugin.transform;
    const fn = (
        typeof hook === 'function' ? hook : hook?.handler
    ) as TransformFn;
    return fn.call({}, code, id);
};

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
