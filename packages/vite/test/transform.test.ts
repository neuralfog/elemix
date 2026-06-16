import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { elemix } from '../src';

// The locally-built compiler binary (has `--stdin`). The published dependency
// picks it up once a native build with --stdin ships; the test script builds it.
const BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../compiler/target/debug/elemix-compiler',
);

const SOURCE = [
    "import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';",
    'export class CounterApp extends Component {',
    '    state = state({ count: 0 });',
    '    increment = () => { this.state.count++; };',
    '    template = () => tpl`<button @click=${this.increment}>${this.state.count}</button>`;',
    '}',
    "defineComponent('counter-app', CounterApp);",
].join('\n');

type TransformFn = (
    this: unknown,
    code: string,
    id: string,
) => Promise<{ code: string } | null>;

// transform may be a function or an { handler } object hook — normalize + call.
const runTransform = (plugin: Plugin, code: string, id: string) => {
    const hook = plugin.transform;
    const fn = (
        typeof hook === 'function' ? hook : hook?.handler
    ) as TransformFn;
    return fn.call({}, code, id);
};

describe('elemix vite plugin', () => {
    it('compiles tpl templates via the native compiler', async () => {
        const result = await runTransform(
            elemix({ bin: BIN }),
            SOURCE,
            '/src/CounterApp.ts',
        );
        expect(result).toBeTruthy();
        expect(result?.code).toContain("from '@neuralfog/elemix/runtime'");
        expect(result?.code).toContain('view()');
        expect(result?.code).not.toContain('tpl`');
    });

    it('skips non-.ts and template-free files', async () => {
        const plugin = elemix({ bin: BIN });
        expect(await runTransform(plugin, SOURCE, '/src/x.js')).toBeNull();
        expect(
            await runTransform(plugin, 'const x = 1;', '/src/x.ts'),
        ).toBeNull();
        expect(
            await runTransform(plugin, 'export class S {}', '/src/store.ts'),
        ).toBeNull();
        expect(
            await runTransform(plugin, SOURCE, '/node_modules/pkg/x.ts'),
        ).toBeNull();
    });

    it('compiles a template-less pragma component (no tpl`)', async () => {
        // A pure-styles wrapper: `#component #styles` and no template. It has no
        // `tpl`, so the old gate skipped it — the pragma would bleed through
        // uncompiled and the element would never register.
        const PRAGMA_ONLY = [
            "import { Component } from '@neuralfog/elemix';",
            'const css = `:host { display: block; }`;',
            '`#component #styles ${css}`',
            'export class Spacer extends Component {}',
        ].join('\n');
        const result = await runTransform(
            elemix({ bin: BIN }),
            PRAGMA_ONLY,
            '/src/Spacer.ts',
        );
        expect(result).toBeTruthy();
        expect(result?.code).toContain("defineComponent('spacer', Spacer)");
        expect(result?.code).toContain('Spacer.__sheets');
        expect(result?.code).not.toContain('`#component');
    });
});
