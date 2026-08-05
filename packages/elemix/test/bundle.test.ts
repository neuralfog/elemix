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

        const required = [
            'Component',
            'defineComponent',
            'ref',
            'tpl',
            '$__state',
            '$__reactive',
            '$__effect',
            '$__untrack',
            '$__bind',
            '$__depOf',
            '$__defineComponent',
            '$__template',
            '$__clone',
            '$__event',
            '$__model',
            '$__onmodel',
            '$__ref',
            '$__child',
            '$__list',
            '$__setText',
            '$__setAttr',
            '$__setClass',
            '$__setStyle',
            '$__setProp',
        ];

        for (const name of required) {
            test(`exports \`${name}\``, () => {
                expect(mod[name]).toBeDefined();
                expect(typeof mod[name]).toBe('function');
            });
        }

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

        const forbiddenIdentifiers = ['present', 'MockCSSStyleSheet'];

        for (const id of forbiddenIdentifiers) {
            test(`does not contain \`${id}\``, () => {
                expect(bundleText).not.toContain(id);
            });
        }

        test('does not import any /testing path', () => {
            expect(bundleText).not.toMatch(/['"`]\.{1,2}\/testing/);
            expect(bundleText).not.toMatch(/@neuralfog\/elemix\/testing/);
        });
    });
});
