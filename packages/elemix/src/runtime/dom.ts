import {
    type Scope,
    collect,
    dispose,
    effect,
    takeScopes,
    untrack,
} from './reactive';
import { toRaw } from './state';

type Getter<T> = () => T;

const toText = (value: unknown): string =>
    typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? ''
          : String(value);

let lisPred = new Int32Array(0);
let lisTails = new Int32Array(0);

const computeLIS = (arr: number[]): number[] => {
    const n = arr.length;
    if (n === 0) return [];
    if (lisPred.length < n) {
        lisPred = new Int32Array(n);
        lisTails = new Int32Array(n);
    }
    const pred = lisPred;
    const tails = lisTails;
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

export const templateEl = (markup: string): Element => {
    const tpl = document.createElement('template');
    tpl.innerHTML = markup;
    const el = tpl.content.firstElementChild as Element;
    return document.importNode(el, true) as Element;
};

export const cloneEl = (master: Element): Element =>
    master.cloneNode(true) as Element;

const sheetCache = new Map<string, CSSStyleSheet>();

const toSheet = (value: string | CSSStyleSheet): CSSStyleSheet => {
    if (typeof value !== 'string') return value;
    let cached = sheetCache.get(value);
    if (!cached) {
        cached = new CSSStyleSheet();
        cached.replaceSync(value);
        sheetCache.set(value, cached);
    }
    return cached;
};

export const sheet = (
    input: string | CSSStyleSheet | ReadonlyArray<string | CSSStyleSheet>,
): CSSStyleSheet[] =>
    Array.isArray(input)
        ? input.map(toSheet)
        : [toSheet(input as string | CSSStyleSheet)];

export const defineComponent = (
    tag: string,
    component: CustomElementConstructor,
): void => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, component);
    }
};

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
    let range: Node[] | null = null;
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

        const frag = next instanceof DocumentFragment;
        if (!range && !frag) {
            if (current) {
                parent.replaceChild(next, current);
            } else {
                parent.insertBefore(next, anchor);
            }
            current = next;
            return;
        }

        if (range) {
            for (const n of range) parent.removeChild(n);
            range = null;
        } else if (current) {
            parent.removeChild(current);
        }
        current = null;
        if (frag) {
            range = [...next.childNodes];
            parent.insertBefore(next, anchor);
        } else {
            parent.insertBefore(next, anchor);
            current = next;
        }
    });
};

const removeRange = (
    parent: Node,
    first: Node,
    last: Node,
    after: Node,
): void => {
    if (
        first === parent.firstChild &&
        (last as ChildNode).nextSibling === after &&
        after.nextSibling === null
    ) {
        (parent as Element).replaceChildren(after);
    } else {
        const range = document.createRange();
        range.setStartBefore(first);
        range.setEndAfter(last);
        range.deleteContents();
    }
};

export const _list = <T>(
    anchor: Node,
    items: Getter<readonly T[]>,
    keyFn: (item: T, index: number) => unknown,
    render: (item: T, index: number) => Node,
): void => {
    const nodes = new Map<unknown, Node>();
    const rowScopes = new Map<unknown, Scope | null>();
    let order: unknown[] = [];
    effect(() => {
        const parent = anchor.parentNode;
        if (!parent) return;
        const list = items();
        const rawList = toRaw(list);
        const len = rawList.length;
        const keys: unknown[] = new Array(len);
        untrack(() => {
            for (let i = 0; i < len; i++) keys[i] = keyFn(rawList[i] as T, i);
        });
        const oldKeys = order;
        order = keys;
        const oldLen = oldKeys.length;

        if (len === 0) {
            if (oldLen > 0) {
                removeRange(
                    parent,
                    nodes.get(oldKeys[0]) as Node,
                    nodes.get(oldKeys[oldLen - 1]) as Node,
                    anchor,
                );
                untrack(() => {
                    for (const sc of rowScopes.values()) dispose(sc);
                });
                rowScopes.clear();
                nodes.clear();
            }
            return;
        }

        let s = 0;
        let oe = oldLen - 1;
        let ne = len - 1;
        while (s <= oe && s <= ne && oldKeys[s] === keys[s]) s++;
        while (s <= oe && s <= ne && oldKeys[oe] === keys[ne]) {
            oe--;
            ne--;
        }

        if (s > oe) {
            if (s <= ne) {
                const ref =
                    ne + 1 < len ? (nodes.get(keys[ne + 1]) as Node) : anchor;
                const frag = document.createDocumentFragment();
                untrack(() => {
                    for (let i = s; i <= ne; i++) {
                        const node = collect(() => render(list[i], i));
                        rowScopes.set(keys[i], takeScopes());
                        nodes.set(keys[i], node);
                        frag.appendChild(node);
                    }
                });
                parent.insertBefore(frag, ref);
            }
            return;
        }

        if (s > ne) {
            for (let i = s; i <= oe; i++) {
                const key = oldKeys[i];
                (nodes.get(key) as ChildNode).remove();
                dispose(rowScopes.get(key) ?? null);
                rowScopes.delete(key);
                nodes.delete(key);
            }
            return;
        }

        if (
            len === oldLen &&
            keys[s] === oldKeys[ne] &&
            keys[ne] === oldKeys[s]
        ) {
            let trans = true;
            for (let i = s + 1; i < ne; i++) {
                if (keys[i] !== oldKeys[i]) {
                    trans = false;
                    break;
                }
            }
            if (trans) {
                const a = nodes.get(oldKeys[ne]) as Node;
                const b = nodes.get(oldKeys[s]) as Node;
                const nextA = (a as ChildNode).nextSibling;
                parent.insertBefore(a, b);
                parent.insertBefore(b, nextA);
                return;
            }
        }

        const toPatch = ne - s + 1;
        const keyToNew = new Map<unknown, number>();
        for (let i = s; i <= ne; i++) keyToNew.set(keys[i], i);

        if (keyToNew.size !== toPatch) {
            order = oldKeys;
            return;
        }

        const newToOld = new Int32Array(toPatch);
        const stale: unknown[] = [];
        let patched = 0;
        let moved = false;
        let maxNew = -1;
        for (let i = s; i <= oe; i++) {
            const key = oldKeys[i];
            const ni = patched < toPatch ? keyToNew.get(key) : undefined;
            if (ni === undefined) {
                stale.push(key);
            } else {
                newToOld[ni - s] = i + 1;
                if (ni >= maxNew) maxNew = ni;
                else moved = true;
                patched++;
            }
        }

        const ref = ne + 1 < len ? (nodes.get(keys[ne + 1]) as Node) : anchor;

        if (patched === 0) {
            for (let i = s; i <= ne; i++) {
                if (nodes.has(keys[i])) {
                    order = oldKeys;
                    return;
                }
            }
            removeRange(
                parent,
                nodes.get(oldKeys[s]) as Node,
                nodes.get(oldKeys[oe]) as Node,
                ref,
            );
            for (let q = 0; q < stale.length; q++) {
                const key = stale[q];
                dispose(rowScopes.get(key) ?? null);
                rowScopes.delete(key);
                nodes.delete(key);
            }
            const frag = document.createDocumentFragment();
            untrack(() => {
                for (let i = s; i <= ne; i++) {
                    const node = collect(() => render(list[i], i));
                    rowScopes.set(keys[i], takeScopes());
                    nodes.set(keys[i], node);
                    frag.appendChild(node);
                }
            });
            parent.insertBefore(frag, ref);
            return;
        }

        for (let q = 0; q < stale.length; q++) {
            const key = stale[q];
            (nodes.get(key) as ChildNode).remove();
            dispose(rowScopes.get(key) ?? null);
            rowScopes.delete(key);
            nodes.delete(key);
        }

        let keep: Uint8Array | null = null;
        if (moved) {
            const seq: number[] = [];
            const seqPos: number[] = [];
            for (let i = 0; i < toPatch; i++) {
                if (newToOld[i] !== 0) {
                    seq.push(newToOld[i]);
                    seqPos.push(i);
                }
            }
            const lis = computeLIS(seq);
            keep = new Uint8Array(toPatch);
            for (let k = 0; k < lis.length; k++) keep[seqPos[lis[k]]] = 1;
        }

        untrack(() => {
            for (let i = toPatch - 1; i >= 0; i--) {
                const isFresh = newToOld[i] === 0;
                if (!isFresh && (!moved || (keep as Uint8Array)[i] === 1)) {
                    continue;
                }
                const ni = s + i;
                const key = keys[ni];
                const r =
                    ni + 1 < len ? (nodes.get(keys[ni + 1]) as Node) : anchor;
                if (isFresh) {
                    const node = collect(() => render(list[ni], ni));
                    rowScopes.set(key, takeScopes());
                    nodes.set(key, node);
                    parent.insertBefore(node, r);
                } else {
                    parent.insertBefore(nodes.get(key) as Node, r);
                }
            }
        });
    });
};

type Cache = { __t?: string; __c?: string; __s?: string };

const attrKeys = new Map<string, string>();

export const _setText = (node: Text, value: unknown): void => {
    const next =
        typeof value === 'string'
            ? value
            : value === null || value === undefined
              ? ''
              : String(value);
    const n = node as Text & Cache;
    if (n.__t === next) return;
    n.__t = next;
    node.data = next;
};

export const _setAttr = (el: Element, name: string, value: unknown): void => {
    let key = attrKeys.get(name);
    if (key === undefined) {
        key = `__a_${name}`;
        attrKeys.set(name, key);
    }
    const cache = el as unknown as Record<string, unknown>;
    if (cache[key] === value) return;
    cache[key] = value;
    const next =
        value === false || value === null || value === undefined
            ? null
            : value === true
              ? ''
              : String(value);
    if (next === null) el.removeAttribute(name);
    else el.setAttribute(name, next);
};

const dedupeClasses = (value: string): string => {
    const seen = new Set<string>();
    let out = '';
    for (const part of value.split(' ')) {
        if (part && !seen.has(part)) {
            seen.add(part);
            out += out.length ? ` ${part}` : part;
        }
    }
    return out;
};

export const _setClass = (
    el: Element,
    _initial: string,
    value: unknown,
): void => {
    let next: string;
    if (typeof value === 'string') {
        next = value.indexOf(' ') === -1 ? value : dedupeClasses(value);
    } else if (value !== null && typeof value === 'object') {
        next = '';
        const obj = value as Record<string, unknown>;
        for (const name in obj) {
            if (obj[name]) next += next.length ? ` ${name}` : name;
        }
    } else {
        next = '';
    }
    const e = el as Element & Cache;
    if (e.__c === next) return;
    const first = e.__c === undefined;
    e.__c = next;
    if (first && next === '') return;
    el.setAttribute('class', next);
};

export const _setStyle = (el: HTMLElement, value: unknown): void => {
    let css = '';
    if (typeof value === 'string') {
        css = value;
    } else if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        for (const name in obj) {
            const v = obj[name];
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
