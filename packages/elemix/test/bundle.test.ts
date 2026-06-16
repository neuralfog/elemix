import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';

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

    describe('exports — the compile-only surface consumers import from', () => {
        let mod: Record<string, unknown>;

        beforeAll(async () => {
            mod = (await import(/* @vite-ignore */ bundleUrl)) as Record<
                string,
                unknown
            >;
        });

        // The bundle entry re-exports ./index + ./runtime. Every public name is
        // a function (Component is a class — still typeof 'function').
        const required = [
            // index: component + registration + utilities + state
            'Component',
            'defineComponent',
            'ref',
            'state',
            // the compile-only template tag (erased by the compiler at build time)
            'tpl',
            // runtime: reactive core
            'reactive',
            'effect',
            'untrack',
            // runtime: DOM-wiring primitives (the codegen contract)
            'template',
            'clone',
            '_event',
            '_model',
            '_onmodel',
            '_ref',
            '_child',
            '_list',
            // grouped-write binders (one effect per template instance)
            '_setText',
            '_setAttr',
            '_setClass',
            '_setStyle',
            '_setProp',
        ];

        for (const name of required) {
            test(`exports \`${name}\``, () => {
                expect(mod[name]).toBeDefined();
                expect(typeof mod[name]).toBe('function');
            });
        }

        // The interpreter is gone — these must never reappear in the bundle.
        // (repeat/when/choose still exist, but on the separate /directives
        // subpath; when/choose are compile-time-only and erased to _child.)
        const absent = [
            'html',
            'signal',
            'Reactive',
            'render',
            'makeCssStylesheet',
            'fastUID',
            'camelToKebabCase',
            'repeat',
            'when',
            'choose',
        ];

        for (const name of absent) {
            test(`does not export \`${name}\``, () => {
                expect(mod[name]).toBeUndefined();
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
});
