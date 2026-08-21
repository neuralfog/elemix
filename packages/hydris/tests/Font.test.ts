import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fontFace, fontFaces } from '../src/render/font';

const dir = mkdtempSync(join(tmpdir(), 'hydris-font-'));
const bytes = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x01, 0x02, 0x03, 0x04]);
const b64 = bytes.toString('base64');

const write = (name: string): string => {
    const path = join(dir, name);
    writeFileSync(path, bytes);
    return path;
};

const woff2 = write('a.woff2');
const woff = write('a.woff');
const ttf = write('a.ttf');
const otf = write('a.otf');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('fontFace', () => {
    it('inlines a woff2 as a base64 data URI with defaults', () => {
        expect(fontFace({ family: 'Space Grotesk', src: woff2 })).toBe(
            `@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:normal;font-style:normal;font-display:swap}`,
        );
    });

    it('maps the mime type and format per extension', () => {
        expect(fontFace({ family: 'W', src: woff })).toContain(
            'data:font/woff;base64,',
        );
        expect(fontFace({ family: 'W', src: woff })).toContain(
            "format('woff')",
        );
        expect(fontFace({ family: 'T', src: ttf })).toContain(
            'data:font/ttf;base64,',
        );
        expect(fontFace({ family: 'T', src: ttf })).toContain(
            "format('truetype')",
        );
        expect(fontFace({ family: 'O', src: otf })).toContain(
            'data:font/otf;base64,',
        );
        expect(fontFace({ family: 'O', src: otf })).toContain(
            "format('opentype')",
        );
    });

    it('applies weight, style, display, stretch and unicode-range', () => {
        const css = fontFace({
            family: 'F',
            src: woff2,
            weight: '300 700',
            style: 'italic',
            display: 'block',
            stretch: '75% 125%',
            unicodeRange: 'U+0000-00FF',
        });
        expect(css).toContain('font-weight:300 700');
        expect(css).toContain('font-style:italic');
        expect(css).toContain('font-display:block');
        expect(css).toContain('font-stretch:75% 125%');
        expect(css).toContain('unicode-range:U+0000-00FF');
    });

    it('accepts a numeric weight', () => {
        expect(fontFace({ family: 'F', src: woff2, weight: 600 })).toContain(
            'font-weight:600',
        );
    });

    it('omits stretch and unicode-range when not given', () => {
        const css = fontFace({ family: 'F', src: woff2 });
        expect(css).not.toContain('font-stretch');
        expect(css).not.toContain('unicode-range');
    });

    it('throws on an unsupported extension', () => {
        const bad = write('a.eot');
        expect(() => fontFace({ family: 'F', src: bad })).toThrow(
            /unsupported font/,
        );
    });

    it('caches so the file is read only once', () => {
        const path = write('cache.woff2');
        const first = fontFace({ family: 'Once', src: path });
        rmSync(path);
        expect(fontFace({ family: 'Once', src: path })).toBe(first);
    });
});

describe('fontFaces', () => {
    it('concatenates multiple faces into one string', () => {
        const css = fontFaces([
            { family: 'A', src: woff2 },
            { family: 'B', src: ttf },
        ]);
        expect(css).toContain("font-family:'A'");
        expect(css).toContain("font-family:'B'");
        expect(css.match(/@font-face\{/g)?.length).toBe(2);
    });
});
