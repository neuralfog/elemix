import { describe, expect, it } from 'vitest';
import { elemix } from '../src';
import { BIN, COUNTER_SOURCE as SOURCE, runTransform } from './harness';

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
        // the source-map chain is intact (not severed with map: null), and
        // points back at the real module id
        expect(result?.map?.version).toBe(3);
        expect(result?.map?.sources).toEqual(['/src/CounterApp.ts']);
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
