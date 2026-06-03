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

/**
 * HTML void elements that genuinely have no closing tag.
 * Per HTML spec, the parser ignores trailing slashes on these — they
 * remain self-closing-shaped and must NOT be expanded.
 */
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

/**
 * Match a self-closing tag of the form `<name attrs.../>` without crossing
 * into adjacent tags. The attribute matcher accepts, in order:
 *   - a double-quoted hole-marker comment (`"<!--...-->"`), which is the only
 *     case where `<` and `>` may appear inside a quoted value
 *   - a regular double-quoted value (excludes `<>` so greedy matching can't
 *     span across multiple quote pairs and swallow intervening tags)
 *   - a regular single-quoted value (same)
 *   - a single character that isn't `<` or `>`
 */
const SELF_CLOSE_RE =
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:"<!--[\s\S]*?-->"|"[^"<>]*"|'[^'<>]*'|[^<>])*?)\s*\/>/g;

/**
 * Browsers do NOT honor XHTML-style self-closing on non-void HTML elements:
 * `<pf-foo />` is parsed as `<pf-foo>` (open) and everything after becomes
 * its child until a closing tag is found. This preprocessor rewrites
 * self-closing non-void tags into explicit open + close so the parser
 * handles them as intended. The attribute matcher treats quoted strings
 * as a single unit so embedded `>` (e.g. inside `<!--MARKER-->` hole
 * placeholders) doesn't terminate the match.
 */
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
