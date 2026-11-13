import { $__reactive, $__toRaw } from './state';

export { $__setViewData, $__viewData } from './viewdata';

type ModuleStateEntry = {
    obj: Record<PropertyKey, unknown>;
    factory: () => unknown;
};

const moduleStates: ModuleStateEntry[] = [];

export const $__moduleState = <T>(factory: () => T): T => {
    const value = $__reactive(factory()) as T;
    if (
        typeof window !== 'undefined' &&
        value !== null &&
        typeof value === 'object'
    ) {
        moduleStates.push({
            obj: value as Record<PropertyKey, unknown>,
            factory,
        });
    }
    return value;
};

export const $__resetModuleStates = (): void => {
    for (const { obj, factory } of moduleStates) {
        const fresh = factory() as Record<PropertyKey, unknown>;
        const raw = $__toRaw(obj) as Record<PropertyKey, unknown>;
        for (const key of Object.keys(raw)) {
            if (!(key in fresh)) delete obj[key];
        }
        for (const key of Object.keys(fresh)) {
            obj[key] = fresh[key];
        }
    }
};

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
    let n: Node | null = node;
    if (n.nodeType !== 3 && dyns[0] !== -1) {
        const text = document.createTextNode('');
        n.parentNode?.insertBefore(text, n);
        n = text;
    }
    for (let i = 0; i < dyns.length; i++) {
        const parent = n ? n.parentNode : null;
        if (statics[i] > 0 && n && n.nodeType === 3) {
            const t = n as Text;
            n = t.length > statics[i] ? t.splitText(statics[i]) : n.nextSibling;
        }
        if (dyns[i] === -1) {
            const mounted: Node[] = [];
            let m: Node | null = n;
            while (m && !(m.nodeType === 8 && (m as Comment).data === '$')) {
                const next: Node | null = m.nextSibling;
                mounted.push(m);
                m = next;
            }
            const anchor = document.createTextNode('') as Text & {
                __r?: Node[] | null;
            };
            parent?.insertBefore(anchor, m);
            if (m) parent?.removeChild(m);
            anchor.__r = mounted.length ? mounted : null;
            out.push(anchor);
            n = anchor.nextSibling;
        } else {
            const value = n as Text;
            n = value.splitText(dyns[i]);
            out.push(value);
        }
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

const $__markerAt = (parent: Node, ordinal: number): Node | null => {
    let seen = -1;
    for (let n = parent.firstChild; n; n = n.nextSibling) {
        if (
            n.nodeType === 8 &&
            (n as Comment).data === '$' &&
            ++seen === ordinal
        )
            return n;
    }
    return null;
};

export const $__span = (
    parent: Node,
    lead: number,
    ordinal: number,
): [Node | null, number] => {
    const marker = $__markerAt(parent, ordinal);
    const prev = ordinal > 0 ? $__markerAt(parent, ordinal - 1) : null;
    let start: Node | null = prev ? prev.nextSibling : parent.firstChild;
    for (let i = 0; i < lead && start; i++) start = start.nextSibling;
    let count = 0;
    for (let n = start; n; n = n.nextSibling) {
        count++;
        if (n === marker) break;
    }
    return [start, count];
};

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
