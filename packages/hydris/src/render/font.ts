import { readFileSync } from 'node:fs';

export type FontFace = {
    family: string;
    src: string;
    weight?: string | number;
    style?: string;
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    stretch?: string;
    unicodeRange?: string;
};

const MIME: Record<string, string> = {
    woff2: 'font/woff2',
    woff: 'font/woff',
    ttf: 'font/ttf',
    otf: 'font/otf',
};

const FORMAT: Record<string, string> = {
    woff2: 'woff2',
    woff: 'woff',
    ttf: 'truetype',
    otf: 'opentype',
};

const encoded = new Map<string, string>();

const base64 = (src: string): string => {
    let data = encoded.get(src);
    if (data === undefined) {
        data = readFileSync(src).toString('base64');
        encoded.set(src, data);
    }
    return data;
};

export const fontFace = (font: FontFace): string => {
    const ext = font.src.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME[ext];
    const format = FORMAT[ext];
    if (mime === undefined) {
        throw new Error(
            `hydris fontFace: unsupported font "${font.src}" (use woff2, woff, ttf or otf)`,
        );
    }
    const decl = [
        `font-family:'${font.family}'`,
        `src:url(data:${mime};base64,${base64(font.src)}) format('${format}')`,
        `font-weight:${font.weight ?? 'normal'}`,
        `font-style:${font.style ?? 'normal'}`,
        `font-display:${font.display ?? 'swap'}`,
    ];
    if (font.stretch) decl.push(`font-stretch:${font.stretch}`);
    if (font.unicodeRange) decl.push(`unicode-range:${font.unicodeRange}`);
    return `@font-face{${decl.join(';')}}`;
};

export const fontFaces = (fonts: FontFace[]): string =>
    fonts.map(fontFace).join('');
