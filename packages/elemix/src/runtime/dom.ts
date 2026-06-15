import {
    effect,
    collect,
    takeScopes,
    dispose,
    untrack,
    type Scope,
} from './reactive';
import { mergeClasses } from '../utilities';

type Getter<T> = () => T;

const toText = (value: unknown): string =>
    value === null || value === undefined ? '' : String(value);

const computeLIS = (arr: number[]): number[] => {
    const n = arr.length;
    if (n === 0) return [];
    const pred = new Int32Array(n);
    const tails = new Int32Array(n);
    let len = 0;
    for (let i = 0; i < n; i++) {
        let lo = 0;
        let hi = len;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (arr[tails[mid]] < arr[i]) lo = mid + 1;
            else hi = mid;
        }
        tails[lo] = i;
        if (lo === len) len++;
        pred[i] = lo > 0 ? tails[lo - 1] : -1;
    }
    const lis = new Array<number>(len);
    let k = tails[len - 1];
    for (let i = len - 1; i >= 0; i--) {
        lis[i] = k;
        k = pred[k];
    }
    return lis;
};

export const template = (markup: string): DocumentFragment => {
    const tpl = document.createElement('template');
    tpl.innerHTML = markup;
    return document.importNode(tpl.content, true);
};

export const clone = (master: DocumentFragment): DocumentFragment =>
    master.cloneNode(true) as DocumentFragment;

type PropTarget = {
    props?: Record<string, unknown>;
    __pendingProps?: Record<string, unknown>;
};

type OnModelEl = HTMLInputElement & {
    __onmodel?: (value: string) => string;
};

export const _model = (
    el: HTMLInputElement,
    get: Getter<{ value: string }>,
): void => {
    effect(() => {
        const ref = get();
        if (el.value === ref.value) return;
        el.value = ref.value;
    });
    el.oninput = (): void => {
        const ref = get();
        if (el.value === ref.value) return;
        const transform = (el as OnModelEl).__onmodel;
        if (transform) el.value = transform(el.value);
        ref.value = el.value;
    };
};

export const _onmodel = (
    el: HTMLInputElement,
    transform: (value: string) => string,
): void => {
    (el as OnModelEl).__onmodel = transform;
};

export const _event = (
    el: Element,
    name: string,
    handler: EventListener,
): void => {
    (el as unknown as Record<string, EventListener>)[`on${name}`] = handler;
};

export const _ref = (el: Element, ref: { value: unknown }): void => {
    ref.value = el;
};

export const _child = (anchor: Node, get: Getter<unknown>): void => {
    let current: Node | null = null;
    let scopes: Scope | null = null;
    effect(() => {
        const parent = anchor.parentNode;
        if (!parent) return;
        const value = collect(() => get());
        const fresh = takeScopes();
        const next =
            value instanceof Node
                ? value
                : document.createTextNode(toText(value));
        if (current === next) {
            dispose(fresh);
            return;
        }
        dispose(scopes);
        scopes = fresh;
        if (current) {
            parent.replaceChild(next, current);
        } else {
            parent.insertBefore(next, anchor);
        }
        current = next;
    });
};

export const _list = <T>(
    anchor: Node,
    items: Getter<readonly T[]>,
    keyFn: (item: T, index: number) => unknown,
    render: (item: T, index: number) => Node,
): void => {
    let nodes = new Map<unknown, Node>();
    const rowScopes = new Map<unknown, Scope | null>();
    effect(() => {
        const parent = anchor.parentNode;
        if (!parent) return;
        const list = items();
        const next = new Map<unknown, Node>();
        const keys: unknown[] = new Array(list.length);

        let survivors = 0;
        untrack(() => {
            for (let i = 0; i < list.length; i++) {
                const key = keyFn(list[i], i);
                keys[i] = key;
                let node = nodes.get(key);
                if (!node) {
                    const item = list[i];
                    const index = i;
                    node = collect(() => render(item, index));
                    rowScopes.set(key, takeScopes());
                } else {
                    survivors++;
                }
                next.set(key, node);
            }
        });

        if (nodes.size > 0 && survivors === 0) {
            let first: Node | undefined;
            let last: Node | undefined;
            for (const node of nodes.values()) {
                if (!first) first = node;
                last = node;
            }
            if (
                first === parent.firstChild &&
                (last as Node).nextSibling === anchor &&
                anchor.nextSibling === null
            ) {
                (parent as Element).replaceChildren(anchor);
            } else {
                const range = document.createRange();
                range.setStartBefore(first as Node);
                range.setEndAfter(last as Node);
                range.deleteContents();
            }
            for (const key of nodes.keys()) {
                dispose(rowScopes.get(key) ?? null);
                rowScopes.delete(key);
            }
        } else if (survivors < nodes.size) {
            for (const [key, node] of nodes) {
                if (!next.has(key)) {
                    (node as ChildNode).remove();
                    dispose(rowScopes.get(key) ?? null);
                    rowScopes.delete(key);
                }
            }
        }

        if (survivors === 0) {
            const frag = document.createDocumentFragment();
            for (let k = 0; k < keys.length; k++)
                frag.appendChild(next.get(keys[k]) as Node);
            parent.insertBefore(frag, anchor);
            nodes = next;
            return;
        }

        const oldPos = new Map<unknown, number>();
        let p = 0;
        for (const key of nodes.keys()) oldPos.set(key, p++);

        const seq: number[] = [];
        const seqPos: number[] = [];
        const fresh = new Uint8Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const oi = oldPos.get(keys[i]);
            if (oi === undefined) {
                fresh[i] = 1;
            } else {
                seq.push(oi);
                seqPos.push(i);
            }
        }

        const keep = new Uint8Array(keys.length);
        const lis = computeLIS(seq);
        for (let i = 0; i < lis.length; i++) keep[seqPos[lis[i]]] = 1;

        let i = keys.length - 1;
        while (i >= 0) {
            if (!fresh[i] && keep[i]) {
                i--;
                continue;
            }
            const ref =
                i + 1 < keys.length ? (next.get(keys[i + 1]) as Node) : anchor;
            if (fresh[i]) {
                let j = i;
                while (j - 1 >= 0 && fresh[j - 1]) j--;
                if (j === i) {
                    parent.insertBefore(next.get(keys[i]) as Node, ref);
                } else {
                    const frag = document.createDocumentFragment();
                    for (let k = j; k <= i; k++)
                        frag.appendChild(next.get(keys[k]) as Node);
                    parent.insertBefore(frag, ref);
                }
                i = j - 1;
            } else {
                const node = next.get(keys[i]) as Node;
                if (node.nextSibling !== ref) {
                    parent.insertBefore(node, ref);
                }
                i--;
            }
        }

        nodes = next;
    });
};

type Cache = { __t?: string; __c?: string; __s?: string };

export const _setText = (node: Text, value: unknown): void => {
    const next = toText(value);
    const n = node as Text & Cache;
    if (n.__t === next) return;
    n.__t = next;
    node.data = next;
};

export const _setAttr = (el: Element, name: string, value: unknown): void => {
    const next =
        value === false || value === null || value === undefined
            ? null
            : value === true
              ? ''
              : String(value);
    const cache = el as unknown as Record<string, string | null | undefined>;
    const key = `__a_${name}`;
    if (cache[key] === next) return;
    cache[key] = next;
    if (next === null) el.removeAttribute(name);
    else el.setAttribute(name, next);
};

export const _setClass = (
    el: Element,
    initial: string,
    value: unknown,
): void => {
    let dynamic = '';
    if (typeof value === 'string') {
        dynamic = value;
    } else if (value !== null && typeof value === 'object') {
        for (const [name, on] of Object.entries(
            value as Record<string, unknown>,
        )) {
            if (on) dynamic += dynamic.length ? ` ${name}` : name;
        }
    }
    const next = mergeClasses(initial, dynamic);
    const e = el as Element & Cache;
    if (e.__c === next) return;
    e.__c = next;
    el.setAttribute('class', next);
};

export const _setStyle = (el: HTMLElement, value: unknown): void => {
    let css = '';
    if (typeof value === 'string') {
        css = value;
    } else if (value !== null && typeof value === 'object') {
        for (const [name, v] of Object.entries(
            value as Record<string, unknown>,
        )) {
            if (v !== null && v !== undefined && v !== false) {
                css += `${name}:${String(v)};`;
            }
        }
    }
    const e = el as HTMLElement & Cache;
    if (e.__s === css) return;
    e.__s = css;
    el.style.cssText = css;
};

export const _setProp = (el: Element, name: string, value: unknown): void => {
    const target = el as unknown as PropTarget;
    if (target.props) {
        target.props[name] = value;
        return;
    }
    if (!target.__pendingProps) target.__pendingProps = {};
    target.__pendingProps[name] = value;
};
