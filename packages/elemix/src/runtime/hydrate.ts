export { $__setViewData, $__viewData } from './viewdata';

export const $__dynLens = (el: Element): number[] => {
    const data = el.getAttribute('data-t');
    if (data === null) return [];
    el.removeAttribute('data-t');
    return data.split(',').map(Number);
};

export const $__splitRun = (
    node: Text,
    statics: number[],
    dyns: number[],
): Text[] => {
    const out: Text[] = [];
    let n = node;
    for (let i = 0; i < dyns.length; i++) {
        const value = statics[i] > 0 ? n.splitText(statics[i]) : n;
        n = value.splitText(dyns[i]);
        out.push(value);
    }
    return out;
};

import { $__hydrating } from './dom';

export const $__text = (parent: Node): Text => {
    const first = parent.firstChild;
    if (first !== null && first.nodeType === 3) return first as Text;
    const node = document.createTextNode('');
    parent.insertBefore(node, first);
    return node;
};

export const $__fresh = <T>(fn: () => T): T => {
    $__hydrating(false);
    try {
        return fn();
    } finally {
        $__hydrating(true);
    }
};

export const $__bounds = (
    parent: Node,
    before: number,
    after: number,
): [Node | null, number] => [
    parent.childNodes[before] ?? null,
    parent.childNodes.length - before - after,
];

export const $__reanchor = (
    parent: Node,
    first: Node | null,
    count: number,
): Comment => {
    const anchor = document.createComment('');
    parent.insertBefore(anchor, first);
    let n = anchor.nextSibling;
    while (count-- > 0 && n) {
        const next = n.nextSibling;
        parent.removeChild(n);
        n = next;
    }
    return anchor;
};

export const $__seat = (
    parent: Node,
    first: Node | null,
    count: number,
): [Comment, Node | null] => {
    let last: Node | null = null;
    let n = first;
    for (let i = 0; i < count && n; i++) {
        last = n;
        n = n.nextSibling;
    }
    const after = count > 0 ? (last ? last.nextSibling : null) : first;
    const anchor = document.createComment('');
    parent.insertBefore(anchor, after);
    return [anchor, count > 0 ? first : null];
};

export const $__resume = <T>(
    server: Node | null,
    hydrate: (root: Node) => T,
    fresh: () => T,
): (() => T) => {
    let pending = server;
    return () => {
        if (pending) {
            const root = pending;
            pending = null;
            return hydrate(root);
        }
        return fresh();
    };
};
