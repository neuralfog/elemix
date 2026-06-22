import { describe, expect, it } from 'vitest';
import { elemix, needsCompile } from '../src';
import { BIN, COUNTER_SOURCE as SOURCE, runTransform } from './harness';

// The full pragma vocabulary, hardcoded INDEPENDENTLY of the plugin's own list:
// if the gate ever narrows (the original bug — `#state` was missing), one of
// these fails. Any pragma that doesn't open the gate bleeds through uncompiled.
const ALL_PRAGMAS = [
    'component',
    'tag',
    'form',
    'no-shadow',
    'styles',
    'state',
    'effect',
    'before-mount',
    'mount',
    'dispose',
];

describe('compile gate', () => {
    it.each(ALL_PRAGMAS)('opens for a `// #%s` comment', (pragma) => {
        expect(needsCompile(`// #${pragma}\nconst x = 0;`)).toBe(true);
    });

    it('opens for a `tpl` template', () => {
        expect(needsCompile('const t = tpl`<div></div>`;')).toBe(true);
    });

    it('stays shut for plain code and non-pragma `#` comments', () => {
        expect(needsCompile('const x = 1;')).toBe(false);
        expect(needsCompile('// #region group\nconst x = 1;')).toBe(false);
        expect(needsCompile('// just a comment\nclass S {}')).toBe(false);
        // a pragma must lead the comment, not sit mid-line
        expect(needsCompile('const x = 1; // #state')).toBe(false);
    });
});

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
        // A pure-styles wrapper: `// #component` + `// #styles` and no template.
        // It has no `tpl`, so the gate must still match on the pragma comment,
        // else the pragma bleeds through and the element never registers.
        const PRAGMA_ONLY = [
            "import { Component } from '@neuralfog/elemix';",
            'const css = `:host { display: block; }`;',
            '',
            '// #component',
            'export class Spacer extends Component {',
            '    // #styles',
            '    styles = css;',
            '}',
        ].join('\n');
        const result = await runTransform(
            elemix({ bin: BIN }),
            PRAGMA_ONLY,
            '/src/Spacer.ts',
        );
        expect(result).toBeTruthy();
        expect(result?.code).toContain("defineComponent('spacer', Spacer)");
        expect(result?.code).toContain('Spacer.__sheets');
        expect(result?.code).not.toContain('// #component');
    });

    it('compiles a module-level `// #state` store (no component, no tpl`)', async () => {
        // A standalone reactive store: `// #state` on a module const, no class
        // and no template. The gate must match on the `#state` pragma alone, else
        // the store is never wrapped in `state()` and stays a plain, dead object.
        const STORE_ONLY = [
            '// #state',
            'export const config = { count: 0 };',
        ].join('\n');
        const result = await runTransform(
            elemix({ bin: BIN }),
            STORE_ONLY,
            '/src/store.ts',
        );
        expect(result).toBeTruthy();
        expect(result?.code).toContain("from '@neuralfog/elemix/runtime'");
        expect(result?.code).toContain('state({ count: 0 })');
        expect(result?.code).not.toContain('// #state');
    });
});
