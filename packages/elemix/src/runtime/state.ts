import { track, trigger, dep, type Dep } from './reactive';

const RAW = Symbol();
const ARRAY = Symbol();

const MUTATORS = new Set<string>([
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
]);

const proxies = new WeakMap<object, object>();
const deps = new WeakMap<object, Map<PropertyKey, Dep>>();

const depFor = (target: object, key: PropertyKey): Dep => {
    let map = deps.get(target);
    if (!map) {
        map = new Map();
        deps.set(target, map);
    }
    let d = map.get(key);
    if (!d) {
        d = dep();
        map.set(key, d);
    }
    return d;
};

type Target = Record<PropertyKey, unknown>;

const objectHandler: ProxyHandler<Target> = {
    get(target, key) {
        if (key === RAW) return target;
        const value = target[key];
        if (value === null || typeof value !== 'object') {
            if (typeof key !== 'symbol') track(depFor(target, key));
            return value;
        }
        if (typeof key !== 'symbol') {
            track(depFor(target, key));
            if (Array.isArray(value)) track(depFor(value, ARRAY));
        }
        return reactive(value);
    },
    set(target, key, value) {
        const prev = target[key];
        if (prev === value) return true;
        target[key] = value;
        if (typeof key !== 'symbol') trigger(depFor(target, key));
        return true;
    },
};

const arrayHandler: ProxyHandler<Target> = {
    get(target, key) {
        if (key === RAW) return target;
        if (typeof key === 'string' && MUTATORS.has(key)) {
            return (...args: unknown[]): unknown => {
                const fn = target[key] as (...a: unknown[]) => unknown;
                const result = fn.apply(target, args);
                trigger(depFor(target, ARRAY));
                return result;
            };
        }
        return reactive(target[key]);
    },
    set(target, key, value) {
        const prev = target[key];
        target[key] = value;
        if (prev !== value) trigger(depFor(target, ARRAY));
        return true;
    },
};

const reactive = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const obj = value as Target;
    if (obj[RAW] !== undefined) return obj;
    const cached = proxies.get(obj);
    if (cached) return cached;
    const handler = Array.isArray(obj) ? arrayHandler : objectHandler;
    const p = new Proxy(obj, handler);
    proxies.set(obj, p);
    return p;
};

export const state = <T extends object>(source: T): T => reactive(source) as T;
