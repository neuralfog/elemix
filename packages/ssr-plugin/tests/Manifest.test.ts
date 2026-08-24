import { describe, expect, it } from 'bun:test';
import { buildManifest } from '../src/build';

const artifact = (kind: string, path: string): Bun.BuildArtifact =>
    ({ kind, path }) as unknown as Bun.BuildArtifact;

describe('buildManifest', () => {
    it('maps each page name to its hashed entry filename', () => {
        const pages = [
            '/app/src/views/pages/HomePage.ts',
            '/app/src/views/pages/DagPage.ts',
        ];
        const outputs = [
            artifact('entry-point', '/out/_elemix/HomePage-abcd1234.js'),
            artifact('chunk', '/out/_elemix/chunk-7kessetj.js'),
            artifact('entry-point', '/out/_elemix/DagPage-9f2e1c07.js'),
        ];
        expect(buildManifest(pages, outputs)).toEqual({
            HomePage: 'HomePage-abcd1234.js',
            DagPage: 'DagPage-9f2e1c07.js',
        });
    });

    it('ignores chunks and pages with no matching entry output', () => {
        const pages = ['/app/src/views/pages/Missing.tsx'];
        const outputs = [artifact('chunk', '/out/_elemix/chunk-xxxx.js')];
        expect(buildManifest(pages, outputs)).toEqual({});
    });

    it('handles .tsx/.jsx page extensions', () => {
        const pages = ['/app/pages/Widget.tsx'];
        const outputs = [
            artifact('entry-point', '/out/_elemix/Widget-deadbeef.js'),
        ];
        expect(buildManifest(pages, outputs)).toEqual({
            Widget: 'Widget-deadbeef.js',
        });
    });
});
