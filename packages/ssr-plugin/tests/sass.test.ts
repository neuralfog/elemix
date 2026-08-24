import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { compileScssFile, resolveAlias, rewriteAliases } from '../src/sass';

const dir = join(import.meta.dir, 'fixtures', 'alias');

describe('scss aliasing', () => {
    it('resolves an import-map alias to a path', () => {
        const resolved = resolveAlias('#s/theme', dir);
        expect(resolved).toBe(join(dir, 'styles', 'theme'));
    });

    it('returns null for a specifier with no matching alias', () => {
        expect(resolveAlias('#nope/x', dir)).toBeNull();
    });

    it('rewrites an aliased @use to a relative path', () => {
        const out = rewriteAliases("@use '#s/theme' as *;", dir);
        expect(out).not.toContain('#s/theme');
        expect(out).toBe("@use './styles/theme' as *;");
    });

    it('leaves a relative @use untouched', () => {
        const src = "@use './styles/theme' as *;";
        expect(rewriteAliases(src, dir)).toBe(src);
    });

    it('compiles a stylesheet that uses aliases, including nested aliases', () => {
        const css = compileScssFile(join(dir, 'comp.scss'));
        expect(css).toContain('color: rgb(1, 2, 3)');
        expect(css).toContain('.base');
        expect(css).toContain('.comp');
    });

    it('still compiles relative @use', () => {
        const css = compileScssFile(join(dir, 'rel.scss'));
        expect(css).toContain('.rel');
        expect(css).toContain('color: rgb(1, 2, 3)');
    });
});
