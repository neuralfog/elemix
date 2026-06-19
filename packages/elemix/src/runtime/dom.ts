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

        if (len > 0) {
            let s = 0;
            let oe = oldKeys.length - 1;
            let ne = len - 1;
            while (s <= oe && s <= ne && oldKeys[s] === keys[s]) s++;
            while (s <= oe && s <= ne && oldKeys[oe] === keys[ne]) {
                oe--;
                ne--;
            }
            if (s > oe) {
                if (s <= ne) {
                    const ref =
                        ne + 1 < len
                            ? (nodes.get(keys[ne + 1]) as Node)
                            : anchor;
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
        }

        const next = new Map<unknown, Node>();
        let survivors = 0;
        untrack(() => {
            for (let i = 0; i < len; i++) {
                const key = keys[i];
                let node = nodes.get(key);
                if (!node) {
                    node = collect(() => render(list[i], i));
                    rowScopes.set(key, takeScopes());
                } else {
                    survivors++;
                }
                next.set(key, node);
            }
        });

        if (nodes.size > 0 && survivors === 0) {
            const first = nodes.get(oldKeys[0]) as Node;
            const last = nodes.get(oldKeys[oldKeys.length - 1]) as Node;
            if (
                first === parent.firstChild &&
                last.nextSibling === anchor &&
                anchor.nextSibling === null
            ) {
                (parent as Element).replaceChildren(anchor);
            } else {
                const range = document.createRange();
                range.setStartBefore(first);
                range.setEndAfter(last);
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
        for (let q = 0; q < oldKeys.length; q++) oldPos.set(oldKeys[q], q);

        const seq: number[] = [];
        const seqPos: number[] = [];
        const fresh = new Uint8Array(keys.length);
        let ordered = true;
        let lastOi = -1;
        for (let i = 0; i < keys.length; i++) {
            const oi = oldPos.get(keys[i]);
            if (oi === undefined) {
                fresh[i] = 1;
            } else {
                if (oi < lastOi) ordered = false;
                lastOi = oi;
                seq.push(oi);
                seqPos.push(i);
            }
        }

        if (ordered && seq.length === keys.length) {
            nodes = next;
            return;
        }

        const keep = new Uint8Array(keys.length);
        if (ordered) {
            for (let i = 0; i < keys.length; i++) if (!fresh[i]) keep[i] = 1;
        } else {
            const lis = computeLIS(seq);
            for (let i = 0; i < lis.length; i++) keep[seqPos[lis[i]]] = 1;
        }

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
