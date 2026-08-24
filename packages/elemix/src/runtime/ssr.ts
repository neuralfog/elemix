import type { Template } from '../types';
import { $__toRaw } from './state';

export { $__setViewData, $__viewData } from './viewdata';

const TEXT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

const DATA_H: Record<string, string> = {
    '&': '&amp;',
    "'": '&#39;',
    '<': '&lt;',
};

const dataAttr = (props: Record<string, unknown>): string =>
    Object.keys(props).length === 0
        ? ''
        : ` data-h='${JSON.stringify(props).replace(/[&'<]/g, (c) => DATA_H[c] ?? c)}'`;

const ATTR: Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
};

type StoreBag = Map<object, Record<PropertyKey, unknown>>;

let current: StoreBag | null = null;
const fallback: StoreBag = new Map();

export const $__runStores = <T>(fn: () => T): T => {
    const prev = current;
    current = new Map();
    try {
        return fn();
    } finally {
        current = prev;
    }
};

export const $__moduleState = <T extends object>(factory: () => T): T => {
    const id = {};
    const resolve = (): Record<PropertyKey, unknown> => {
        const bag = current ?? fallback;
        let inst = bag.get(id);
        if (inst === undefined) {
            inst = factory() as Record<PropertyKey, unknown>;
            bag.set(id, inst);
        }
        return inst;
    };
    return new Proxy({} as Record<PropertyKey, unknown>, {
        get: (_, p) => resolve()[p],
        set: (_, p, v) => {
            resolve()[p] = v;
            return true;
        },
        has: (_, p) => p in resolve(),
        deleteProperty: (_, p) => {
            delete resolve()[p];
            return true;
        },
        ownKeys: () => Reflect.ownKeys(resolve()),
        getOwnPropertyDescriptor: (_, p) =>
            Object.getOwnPropertyDescriptor(resolve(), p),
    }) as T;
};

export type Rope = string | Rope[];

export const $__ssrTpl = (...parts: unknown[]): Template =>
    (parts.length === 1 ? parts[0] : parts) as unknown as Template;

export const $__render = (rope: Rope): string => {
    if (typeof rope === 'string') return rope;
    const parts: string[] = [];
    const stack: Rope[] = [rope];
    while (stack.length > 0) {
        const top = stack.pop() as Rope;
        if (typeof top === 'string') {
            parts.push(top);
        } else {
            for (let i = top.length - 1; i >= 0; i--) stack.push(top[i]);
        }
    }
    return parts.join('');
};

export const $__ssrText = (value: unknown): Rope => {
    if (Array.isArray(value)) return value as Rope;
    return value == null
        ? ''
        : String(value).replace(/[&<>]/g, (c) => TEXT[c] ?? c);
};

const attrEsc = (value: string): string =>
    value.replace(/[&"<>]/g, (c) => ATTR[c] ?? c);

export const $__ssrAttr = (name: string, value: unknown): string => {
    if (value === false || value === null || value === undefined) return '';
    if (value === true) return ` ${name}=""`;
    return ` ${name}="${attrEsc(String(value))}"`;
};

export const $__ssrClass = (value: unknown): string => {
    let next = '';
    if (typeof value === 'string') {
        next = value;
    } else if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        for (const name in obj) {
            if (obj[name]) next += next.length ? ` ${name}` : name;
        }
    }
    return next === '' ? '' : ` class="${attrEsc(next)}"`;
};

export const $__ssrStyle = (value: unknown): string => {
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
    return css === '' ? '' : ` style="${attrEsc(css)}"`;
};

export const $__ssrLen = (value: unknown): number =>
    value == null ? 0 : String(value).length;

export const $__ssrRepeat = <T>(
    list: T[],
    cb: (val: T, index: number) => unknown,
): Rope => {
    const raw = $__toRaw(list);
    const out: Rope[] = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = cb(raw[i], i) as Rope;
    return out;
};

export const $__ssrWhen = (
    cond: unknown,
    then: () => unknown,
    otherwise?: () => unknown,
): Rope => (cond ? then() : otherwise ? otherwise() : '') as Rope;

export const $__ssrChoose = (
    cases: Array<[cond: unknown, body: () => unknown]>,
): Rope => {
    for (const [cond, body] of cases) {
        if (cond) return body() as Rope;
    }
    return '';
};

export const $__ssrMatch = (
    value: unknown,
    keyOrCases: unknown,
    cases?: Record<PropertyKey, (member?: unknown) => unknown>,
): Rope => {
    if (cases === undefined) {
        const map = keyOrCases as Record<PropertyKey, () => unknown>;
        const body = map[value as PropertyKey];
        return (body ? body() : '') as Rope;
    }
    const member = value as Record<PropertyKey, PropertyKey>;
    const body = cases[member[keyOrCases as PropertyKey]];
    return (body ? body(member) : '') as Rope;
};

interface SsrComponent {
    $$__props?: Record<string, unknown>;
    $$__attachFormInternals?(): void;
    $$__beforeMount?(): void;
    $$__ssr(): Rope;
    children?: unknown[];
}

export const $__ssrChild = (
    tag: string,
    props: Record<string, unknown>,
    slot?: unknown,
    attrs = '',
    slotNames?: string[],
): Rope => {
    const ctor = customElements.get(tag) as
        | (new () => SsrComponent)
        | undefined;
    if (ctor === undefined) return '';
    const clientOnly = (ctor as { $$__client?: boolean }).$$__client === true;
    const propSafe = (ctor as { $$__propSafe?: boolean }).$$__propSafe === true;
    const inject = `${attrs}${clientOnly || !propSafe ? dataAttr(props) : ''}`;
    const hasSlot =
        slot !== undefined &&
        slot !== '' &&
        !(Array.isArray(slot) && slot.length === 0);
    if (clientOnly) {
        return hasSlot
            ? [`<${tag}${inject}>`, slot as Rope, `</${tag}>`]
            : `<${tag}${inject}></${tag}>`;
    }
    const child = new ctor();
    if (slotNames !== undefined && slotNames.length > 0) {
        child.children = slotNames.map((name) => ({
            getAttribute: (attr: string) => (attr === 'slot' ? name : null),
        }));
    }
    child.$$__props = props;
    child.$$__attachFormInternals?.();
    child.$$__beforeMount?.();
    const rendered = child.$$__ssr();
    const parts: Rope[] = Array.isArray(rendered) ? rendered : [rendered];
    if (inject !== '') {
        const first = parts[0];
        if (typeof first === 'string') {
            const open = `<${tag}`;
            parts[0] = first.startsWith(open)
                ? `${open}${inject}${first.slice(open.length)}`
                : first.replace(open, `${open}${inject}`);
        }
    }
    if (!hasSlot) return parts;
    const close = `</${tag}>`;
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (typeof last === 'string' && last.endsWith(close)) {
        parts[lastIdx] = last.slice(0, -close.length);
        return [parts, slot as Rope, close];
    }
    return [parts, slot as Rope];
};
