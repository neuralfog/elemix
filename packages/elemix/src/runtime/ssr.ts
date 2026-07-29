export { $__setViewData, $__viewData } from './viewdata';

const TEXT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

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

export const $__scopedStore = <T extends object>(factory: () => T): T => {
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

const SSR_TPL = Symbol();

export const $__ssrTpl = (
    html: string,
): { [SSR_TPL]: string; toString(): string } => ({
    [SSR_TPL]: html,
    toString: () => html,
});

export const $__ssrText = (value: unknown): string => {
    if (value !== null && typeof value === 'object' && SSR_TPL in value) {
        return (value as { [SSR_TPL]: string })[SSR_TPL];
    }
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
    cb: (val: T, index: number) => string,
): string => list.map((v, i) => cb(v, i)).join('');

export const $__ssrWhen = (
    cond: unknown,
    then: () => string,
    otherwise?: () => string,
): string => (cond ? then() : otherwise ? otherwise() : '');

export const $__ssrChoose = (
    cases: Array<[cond: unknown, body: () => string]>,
): string => {
    for (const [cond, body] of cases) {
        if (cond) return body();
    }
    return '';
};

export const $__ssrMatch = (
    value: unknown,
    keyOrCases: unknown,
    cases?: Record<PropertyKey, (member?: unknown) => string>,
): string => {
    if (cases === undefined) {
        const map = keyOrCases as Record<PropertyKey, () => string>;
        const body = map[value as PropertyKey];
        return body ? body() : '';
    }
    const member = value as Record<PropertyKey, PropertyKey>;
    const body = cases[member[keyOrCases as PropertyKey]];
    return body ? body(member) : '';
};

interface SsrComponent {
    $$__pendingProps?: Record<string, unknown>;
    $$__initProps(): void;
    $$__attachFormInternals?(): void;
    $$__beforeMount?(): void;
    $$__ssr(): string;
    children?: unknown[];
}

export const $__ssrChild = (
    tag: string,
    props: Record<string, unknown>,
    slot = '',
    attrs = '',
): string => {
    const ctor = customElements.get(tag) as
        | (new () => SsrComponent)
        | undefined;
    if (ctor === undefined) return '';
    if ((ctor as { $$__client?: boolean }).$$__client) {
        let inject = attrs;
        if (Object.keys(props).length > 0) {
            const data = JSON.stringify(props)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;');
            inject += ` data-h="${data}"`;
        }
        return `<${tag}${inject}>${slot}</${tag}>`;
    }
    const child = new ctor();
    if (slot !== '') {
        child.children = [...slot.matchAll(/\bslot="([^"]*)"/g)].map((m) => ({
            getAttribute: (attr: string) => (attr === 'slot' ? m[1] : null),
        }));
    }
    child.$$__pendingProps = props;
    child.$$__initProps();
    child.$$__attachFormInternals?.();
    child.$$__beforeMount?.();
    let html = child.$$__ssr();
    let inject = attrs;
    if (Object.keys(props).length > 0) {
        const data = JSON.stringify(props)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
        inject += ` data-h="${data}"`;
    }
    if (inject !== '') {
        html = html.replace(`<${tag}`, `<${tag}${inject}`);
    }
    if (slot === '') return html;
    const close = `</${tag}>`;
    return html.endsWith(close)
        ? `${html.slice(0, -close.length)}${slot}${close}`
        : `${html}${slot}`;
};
