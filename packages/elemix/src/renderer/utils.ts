import { MARKER } from './types';

const MARKER_RE = new RegExp(`${MARKER}(\\d+)`);

export const indexFromMarker = (comment: string): number => {
    const match = comment.match(MARKER_RE);
    if (!match) throw new Error('Unable to extract index from hole comment');
    return Number(match[1]);
};

export const makeMarker = (index: number): string => `<!--${MARKER}${index}-->`;

const START_TAG_RE =
    /<[a-zA-Z][a-zA-Z0-9-]*(?:<!--[^<>]*-->|"[^"]*"|'[^']*'|[^<>"'])*>/g;

export const fixAttributeQuotes = (input: string): string =>
    input.replace(START_TAG_RE, (tag) =>
        tag.replace(/(\S+)=((<!--[\s\S]*?-->)|([^\s'">]+))/g, '$1="$2"'),
    );

const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
]);

const SELF_CLOSE_RE =
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:"<!--[^<>]*-->"|"[^"<>]*"|'[^'<>]*'|[^<>])*?)\s*\/>/g;

export const fixSelfClosing = (input: string): string =>
    input.replace(SELF_CLOSE_RE, (match, tag: string, attrs: string) =>
        VOID_ELEMENTS.has(tag.toLowerCase())
            ? match
            : `<${tag}${attrs}></${tag}>`,
    );

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
