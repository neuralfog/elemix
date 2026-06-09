import type { AttrDef, Fragment, Hole, HtmlTemplate } from './types';
import { MARKER } from './types';
import {
    fixAttributeQuotes,
    fixSelfClosing,
    indexFromMarker,
    makeMarker,
} from './utils';
import { applyAttribute, createContentHole, detectAttribute } from './holes';

const CONTENT = 0;
const ATTR = 1;

type Part =
    | { kind: typeof CONTENT; index: number; path: number[] }
    | { kind: typeof ATTR; def: AttrDef; path: number[] };

type Prepared = { tpl: HTMLTemplateElement; parts: Part[] };

const templateCache = new WeakMap<TemplateStringsArray, Prepared>();

const pathTo = (node: Node, root: Node): number[] => {
    const path: number[] = [];
    let n: Node = node;
    while (n !== root) {
        const parent = n.parentNode;
        if (!parent) break;
        const siblings = parent.childNodes;
        let i = 0;
        while (siblings[i] !== n) i++;
        path.push(i);
        n = parent;
    }
    return path;
};

const resolve = (root: Node, path: number[]): Node =>
    path.reduceRight((node, i) => node.childNodes[i], root);

const prepare = (strings: TemplateStringsArray): Prepared => {
    const cached = templateCache.get(strings);
    if (cached) return cached;

    const attrs: AttrDef[] = [];
    let markup = '';
    for (let i = 0, len = strings.length; i < len; i++) {
        markup += strings[i];
        if (i < len - 1) {
            const attr = detectAttribute(strings[i], i);
            if (attr) attrs.push(attr);
            markup += makeMarker(i);
        }
    }
    markup = fixSelfClosing(fixAttributeQuotes(markup));

    const tpl = document.createElement('template');
    tpl.innerHTML = markup;

    const byMarker = new Map<string, AttrDef>();
    for (const d of attrs) byMarker.set(d.value, d);

    const content = tpl.content;
    const parts: Part[] = [];
    const w = document.createTreeWalker(
        content,
        NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
        // eslint-disable-next-line no-null/no-null
        null,
    );
    let n: Node | null = w.nextNode();
    while (n) {
        if (n.nodeType === 8) {
            const nodeValue = n.nodeValue;
            if (nodeValue?.startsWith(MARKER)) {
                parts.push({
                    kind: CONTENT,
                    index: indexFromMarker(nodeValue),
                    path: pathTo(n, content),
                });
            }
        } else {
            const el = n as Element;
            const { attributes } = el;
            for (let i = 0, len = attributes.length; i < len; i++) {
                const def = byMarker.get(attributes[i].value);
                if (def) parts.push({ kind: ATTR, def, path: pathTo(el, content) });
            }
        }
        n = w.nextNode();
    }

    const prepared: Prepared = { tpl, parts };
    templateCache.set(strings, prepared);
    return prepared;
};

export const createFragment = (template: HtmlTemplate): Fragment => {
    const holes = new Map<number, Hole>();
    const { tpl, parts } = prepare(template.strings);

    const clone = (): DocumentFragment =>
        tpl.content.cloneNode(true) as DocumentFragment;

    const hydrate = (frag: DocumentFragment, values: unknown[]): void => {
        for (let i = 0, len = parts.length; i < len; i++) {
            const part = parts[i];
            const node = resolve(frag, part.path);
            if (part.kind === CONTENT) {
                holes.set(
                    part.index,
                    createContentHole(
                        values[part.index],
                        node as Comment,
                        createFragment,
                    ),
                );
            } else {
                applyAttribute(node as HTMLElement, part.def, holes);
            }
        }
    };

    /**
     * Push every hole's initial value into the (still-disconnected) DOM
     * subtree so that custom-element `connectedCallback` / `beforeMount`
     * see the real attribute / property values — not the literal
     * `<!--MARKER-->` strings the parser put there. Without this,
     * `getAttribute('data-foo')` in `beforeMount` would return the marker
     * comment and any consumer parsing it (e.g. `JSON.parse`) would throw.
     */
    const applyInitial = (values: unknown[]): void => {
        for (const [i, hole] of holes) hole(values[i]);
    };

    const mount = (target: ParentNode, values: unknown[]): void => {
        const frag = clone();
        hydrate(frag, values);
        applyInitial(values);
        target.appendChild(frag);
    };

    const mountBefore = (ref: ChildNode, values: unknown[]): ChildNode[] => {
        const frag = clone();
        hydrate(frag, values);
        applyInitial(values);
        const children = Array.from(frag.childNodes);
        ref.before(frag);
        return children;
    };

    const update = (values: unknown[]): void => {
        for (const [i, hole] of holes) hole(values[i]);
    };

    return { mount, mountBefore, update };
};
