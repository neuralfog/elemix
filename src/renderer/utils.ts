import { MARKER } from './types';

const MARKER_RE = new RegExp(`${MARKER}(\\d+)`);

export const indexFromMarker = (comment: string): number => {
    const match = comment.match(MARKER_RE);
    if (!match) throw new Error('Unable to extract index from hole comment');
    return Number(match[1]);
};

export const makeMarker = (index: number): string => `<!--${MARKER}${index}-->`;

export const fixAttributeQuotes = (input: string): string =>
    input.replace(/(\S+)=((<!--[\s\S]*?-->)|([^\s">]+))/g, '$1="$2"');

export const camelToKebab = (s: string): string =>
    s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);

export const mergeClasses = (a: string, b: string): string => {
    const seen = new Set<string>();
    let out = '';
    const add = (s: string) => {
        const parts = s.split(' ');
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p && !seen.has(p)) {
                seen.add(p);
                if (out.length) out += ' ';
                out += p;
            }
        }
    };
    add(a);
    add(b);
    return out;
};
