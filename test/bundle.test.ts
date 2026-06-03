import { expect, test, describe, beforeAll } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '../package.json'), 'utf-8'),
) as { version: string };

const repoRoot = resolve(__dirname, '..');
const bundlePath = resolve(repoRoot, `bundle/elemix-v${pkg.version}.js`);
const bundleUrl = pathToFileURL(bundlePath).href;

describe(`Vendored bundle (elemix-v${pkg.version}.js)`, () => {
    beforeAll(() => {
        // Always rebuild so the assertions below reflect the current source.
        execSync('npm run build:bundle --silent', {
            cwd: repoRoot,
            stdio: 'inherit',
        });
    }, 60_000);

    test('bundle exists and is non-empty', () => {
        const size = statSync(bundlePath).size;
        expect(size).toBeGreaterThan(1024);
    });

    test('bundle is reasonably small (<= 20 KB raw, regression guard)', () => {
        const size = statSync(bundlePath).size;
        expect(size).toBeLessThanOrEqual(20 * 1024);
    });

    describe('exports — the entry points consumers import from', () => {
        let mod: Record<string, unknown>;

        beforeAll(async () => {
            mod = (await import(/* @vite-ignore */ bundleUrl)) as Record<
                string,
                unknown
            >;
        });

        const required = [
            // index — Component class + html tag + RenderTrigger
            { name: 'Component', kind: 'function' },
            { name: 'html', kind: 'function' },
            { name: 'RenderTrigger', kind: 'object' },
            // decorators
            { name: 'component', kind: 'function' },
            { name: 'state', kind: 'function' },
            // directives
            { name: 'repeat', kind: 'function' },
            // signal
            { name: 'signal', kind: 'function' },
            // reactive
            { name: 'Reactive', kind: 'function' },
            // app
            { name: 'initApp', kind: 'function' },
            { name: 'App', kind: 'function' },
            // utilities
            { name: 'ref', kind: 'function' },
            { name: 'fastUID', kind: 'function' },
            { name: 'camelToKebabCase', kind: 'function' },
            { name: 'makeCssStylesheet', kind: 'function' },
            { name: 'render', kind: 'function' },
        ];

        for (const { name, kind } of required) {
            test(`exports \`${name}\``, () => {
                expect(mod[name]).toBeDefined();
                expect(typeof mod[name]).toBe(kind);
            });
        }
    });

    describe('testing surface — must NOT be shipped in the vendored bundle', () => {
        let bundleText: string;

        beforeAll(() => {
            bundleText = readFileSync(bundlePath, 'utf-8');
        });

        const forbiddenIdentifiers = [
            // testing helpers
            'present',
            'MockCSSStyleSheet',
            'prettifyHTML',
            'extractHTML',
            'waitFor',
            // rehype / unified runtime dependencies — only used by testing/snapshots
            'rehype-parse',
            'rehype-format',
            'rehype-stringify',
            'unified',
        ];

        for (const id of forbiddenIdentifiers) {
            test(`does not contain \`${id}\``, () => {
                expect(bundleText).not.toContain(id);
            });
        }

        test('does not import any /testing path', () => {
            // CJS or ESM import strings should not reference our /testing paths.
            expect(bundleText).not.toMatch(/['"`]\.{1,2}\/testing/);
            expect(bundleText).not.toMatch(/@neuralfog\/elemix\/testing/);
        });
    });

    describe('removed APIs — must NOT be present in the bundle', () => {
        let bundleText: string;

        beforeAll(() => {
            bundleText = readFileSync(bundlePath, 'utf-8');
        });

        const removed = [
            'bind-attrs',
            'bind-events',
            'BIND_ATTRS',
            'BIND_EVENTS',
        ];

        for (const id of removed) {
            test(`does not contain \`${id}\``, () => {
                expect(bundleText).not.toContain(id);
            });
        }
    });
});
