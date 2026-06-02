import type { AttrDef, Fragment, Hole, HtmlTemplate } from './types';
import { MARKER } from './types';
import { fixAttributeQuotes, indexFromMarker, makeMarker } from './utils';
import { createContentHole, detectAttribute, hydrateAttributes } from './holes';

export const createFragment = (template: HtmlTemplate): Fragment => {
    const holes = new Map<number, Hole>();
    const attrs: AttrDef[] = [];
    let tpl: HTMLTemplateElement | undefined;

    let markup = '';
    const { strings } = template;
    for (let i = 0, len = strings.length; i < len; i++) {
        markup += strings[i];
        if (i < len - 1) {
            const attr = detectAttribute(strings[i], i);
            if (attr) attrs.push(attr);
            markup += makeMarker(i);
        }
    }
    markup = fixAttributeQuotes(markup);

    const clone = (): DocumentFragment => {
        if (!tpl) {
            tpl = document.createElement('template');
            tpl.innerHTML = markup;
        }
        return tpl.content.cloneNode(true) as DocumentFragment;
    };

    const hydrate = (frag: DocumentFragment, values: unknown[]): void => {
        const w = document.createTreeWalker(
            frag,
            NodeFilter.SHOW_COMMENT,
            // eslint-disable-next-line no-null/no-null
            null,
        );
        while (w.nextNode()) {
            const { nodeValue } = w.currentNode;
            if (nodeValue?.startsWith(MARKER)) {
                const idx = indexFromMarker(nodeValue);
                holes.set(
                    idx,
                    createContentHole(
                        values[idx],
                        w.currentNode as Comment,
                        createFragment,
                    ),
                );
            }
        }
        hydrateAttributes(frag, attrs, holes);
    };

    const mount = (target: ParentNode, values: unknown[]): void => {
        const frag = clone();
        hydrate(frag, values);
        target.appendChild(frag);
    };

    const mountBefore = (ref: ChildNode, values: unknown[]): ChildNode[] => {
        const frag = clone();
        hydrate(frag, values);
        const children = Array.from(frag.childNodes);
        ref.before(frag);
        return children;
    };

    const update = (values: unknown[]): void => {
        for (const [i, hole] of holes) hole(values[i]);
    };

    return { mount, mountBefore, update };
};
