import { effect, collect, dispose, type Scope } from './reactive';
import { currentOwner, markMutation, withOwner } from './mutation';
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

export const template = (markup: string): HTMLTemplateElement => {
    const tpl = document.createElement('template');
    tpl.innerHTML = markup;
    return tpl;
};

export const clone = (tpl: HTMLTemplateElement): DocumentFragment =>
    tpl.content.cloneNode(true) as DocumentFragment;

export const _text = (node: Text, get: Getter<unknown>): void => {
    const owner = currentOwner();
    effect(() => {
        const next = toText(get());
        if (node.data === next) return;
        node.data = next;
        markMutation(owner);
    });
};

export const _attr = (
    el: Element,
    name: string,
    get: Getter<unknown>,
): void => {
    const owner = currentOwner();
    let last: string | null | undefined;
    effect(() => {
        const value = get();
        const next =
            value === false || value === null || value === undefined
                ? null
                : value === true
                  ? ''
                  : String(value);
        if (next === last) return;
        last = next;
        if (next === null) el.removeAttribute(name);
        else el.setAttribute(name, next);
        markMutation(owner);
    });
};

type PropTarget = {
    props?: Record<string, unknown>;
    __pendingProps?: Record<string, unknown>;
};

export const _prop = (
    el: Element,
    name: string,
    get: Getter<unknown>,
): void => {
    const target = el as unknown as PropTarget;
    effect(() => {
        const value = get();
        if (target.props) {
            target.props[name] = value;
            return;
        }
        if (!target.__pendingProps) target.__pendingProps = {};
        target.__pendingProps[name] = value;
    });
};

type OnModelEl = HTMLInputElement & {
    __onmodel?: (value: string) => string;
};

export const _model = (
    el: HTMLInputElement,
    get: Getter<{ value: string }>,
): void => {
    const owner = currentOwner();
    effect(() => {
        const ref = get();
        if (el.value === ref.value) return;
        el.value = ref.value;
        markMutation(owner);
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
    Reflect.set(el, `on${name}`, handler);
};

export const _ref = (el: Element, ref: { value: unknown }): void => {
    ref.value = el;
};

export const _child = (anchor: Node, get: Getter<unknown>): void => {
    const owner = currentOwner();
    let current: Node | null = null;
    let scopes = new Set<Scope>();
    effect(() => {
        const parent = anchor.parentNode;
        if (!parent) return;
        const sink = new Set<Scope>();
        const value = collect(sink, () => withOwner(owner, () => get()));
        const next =
            value instanceof Node
                ? value
                : document.createTextNode(toText(value));
        if (current === next) {
            for (const scope of sink) dispose(scope);
            return;
        }
        for (const scope of scopes) dispose(scope);
        scopes = sink;
        if (current) {
            parent.replaceChild(next, current);
        } else {
            parent.insertBefore(next, anchor);
        }
        current = next;
        markMutation(owner);
    });
};

export const _list = <T>(
    anchor: Node,
    items: Getter<readonly T[]>,
    keyFn: (item: T, index: number) => unknown,
    render: (item: T, index: number) => Node,
): void => {
    const owner = currentOwner();
    let nodes = new Map<unknown, Node>();
    const rowScopes = new Map<unknown, Set<Scope>>();
    effect(() => {
        const parent = anchor.parentNode;
        if (!parent) return;
        const list = items();
        const next = new Map<unknown, Node>();
        const keys: unknown[] = new Array(list.length);
        let changed = false;

        for (let i = 0; i < list.length; i++) {
            const key = keyFn(list[i], i);
            keys[i] = key;
            let node = nodes.get(key);
            if (!node) {
                const sink = new Set<Scope>();
                const item = list[i];
                const index = i;
                node = collect(sink, () =>
                    withOwner(owner, () => render(item, index)),
                );
                rowScopes.set(key, sink);
                changed = true;
            }
            next.set(key, node);
        }

        for (const [key, node] of nodes) {
            if (!next.has(key)) {
                (node as ChildNode).remove();
                const sink = rowScopes.get(key);
                if (sink) {
                    for (const scope of sink) dispose(scope);
                    rowScopes.delete(key);
                }
                changed = true;
            }
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

        for (let i = keys.length - 1; i >= 0; i--) {
            if (!fresh[i] && keep[i]) continue;
            const node = next.get(keys[i]) as Node;
            const ref =
                i + 1 < keys.length ? (next.get(keys[i + 1]) as Node) : anchor;
            if (node.nextSibling !== ref) {
                parent.insertBefore(node, ref);
                changed = true;
            }
        }

        nodes = next;
        if (changed) markMutation(owner);
    });
};

export const _class = (el: Element, get: Getter<unknown>): void => {
    const owner = currentOwner();
    const initial = el.getAttribute('class') ?? '';
    let last: string | undefined;
    effect(() => {
        const value = get();
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
        if (next === last) return;
        last = next;
        el.setAttribute('class', next);
        markMutation(owner);
    });
};

export const _style = (el: HTMLElement, get: Getter<unknown>): void => {
    const owner = currentOwner();
    let last: string | undefined;
    effect(() => {
        const value = get();
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
        if (css === last) return;
        last = css;
        el.style.cssText = css;
        markMutation(owner);
    });
};
