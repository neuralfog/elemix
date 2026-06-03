import { MARKER } from './types';

const MARKER_RE = new RegExp(`${MARKER}(\\d+)`);

export const indexFromMarker = (comment: string): number => {
    const match = comment.match(MARKER_RE);
    if (!match) throw new Error('Unable to extract index from hole comment');
    return Number(match[1]);
};

export const makeMarker = (index: number): string => `<!--${MARKER}${index}-->`;

/**
 * Wrap unquoted attribute values in double quotes so the HTML parser
 * accepts them. Two cases match:
 *   - `attr=<!--MARKER-->` — a template-hole comment substituted into an
 *     attribute position (the marker contains `>`, so it has to be matched
 *     explicitly instead of via the bare-value class).
 *   - `attr=value` — a literal unquoted run of non-whitespace, non-quote,
 *     non-`>` characters.
 *
 * Already-quoted values (double OR single quoted) are deliberately left
 * untouched — the leading quote causes the bare matcher to fail (both `"`
 * and `'` are excluded), so the regex never tries to "fix" them and the
 * original quoting survives intact.
 */
export const fixAttributeQuotes = (input: string): string =>
    input.replace(/(\S+)=((<!--[\s\S]*?-->)|([^\s'">]+))/g, '$1="$2"');

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
 *   - a double-quoted hole-marker comment (`"<!--...-->"`). The inner content
 *     uses `[^<>]*` (NOT `[\s\S]*?`) so the marker matcher can never
 *     backtrack across `>`/`<` chars and span multiple separate markers —
 *     that would let `<div .class="<!--₥0-->" >...<input ... .x="<!--₥6-->"/>`
 *     be matched as one self-close on `div`, swallowing the input and
 *     incorrectly closing the wrapper after it.
 *   - a regular double-quoted value (excludes `<>` for the same reason).
 *   - a regular single-quoted value (same).
 *   - a single character that isn't `<` or `>`.
 */
const SELF_CLOSE_RE =
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:"<!--[^<>]*-->"|"[^"<>]*"|'[^'<>]*'|[^<>])*?)\s*\/>/g;

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
