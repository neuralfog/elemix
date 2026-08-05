import { describe, expect, it } from 'vitest';
import { elemix, needsCompile } from '../src';
import { BIN, COUNTER_SOURCE as SOURCE, runTransform } from './harness';

const ALL_PRAGMAS = [
    'component',
    'tag',
    'form',
    'no-shadow',
    'shadow',
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
        expect(result?.code).toContain('$$__view()');
        expect(result?.code).not.toContain('tpl`');
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
        expect(result?.code).toContain("$__defineComponent('spacer', Spacer)");
        expect(result?.code).toContain('Spacer.$$__sheets');
        expect(result?.code).not.toContain('// #component');
    });

    it('compiles a free-standing `tpl` render into an inline builder (no wrapper)', async () => {
        const FREE = [
            "import { tpl } from '@neuralfog/elemix';",
            "import './ProfileCard';",
            'export const render = () =>',
            '    tpl`<profile-card :name=${"Ada"} @pick=${() => {}}></profile-card>`;',
        ].join('\n');
        const result = await runTransform(
            elemix({ bin: BIN }),
            FREE,
            '/src/Story.ts',
        );
        expect(result).toBeTruthy();
        expect(result?.code).toContain("from '@neuralfog/elemix/runtime'");
        expect(result?.code).toContain('(() => {');
        expect(result?.code).toContain('$__setProp');
        expect(result?.code).toContain('$__event');
        expect(result?.code).not.toContain('tpl`');
        expect(result?.code).toContain("import './ProfileCard'");
    });

    it('compiles a bare standalone `tpl` module const into an inline builder', async () => {
        const STANDALONE = [
            "import { tpl } from '@neuralfog/elemix';",
            "import './ProfileCard';",
            'export const view = tpl`<profile-card :name=${"Ada"}></profile-card>`;',
        ].join('\n');
        const result = await runTransform(
            elemix({ bin: BIN }),
            STANDALONE,
            '/src/view.ts',
        );
        expect(result).toBeTruthy();
        const code = result?.code ?? '';
        expect(code).toContain("from '@neuralfog/elemix/runtime'");
        expect(code).toMatch(/const _ft0 = \$__template\(/);
        expect(code).toMatch(/export const view = \(\(\) => \{/);
        expect(code).toContain('$__clone(_ft0)');
        expect(code).toContain('$__setProp');
        expect(code).toMatch(/return _r0;\s*\}\)\(\);/);
        expect(code).not.toContain('tpl`');
        expect(code).toContain("import './ProfileCard'");
    });

    it('compiles a module-level `// #state` store (no component, no tpl`)', async () => {
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
