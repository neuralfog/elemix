import { type Dep, $__dep, $__track, $__trigger } from './reactive';

const RAW = Symbol();
const ARRAY = Symbol();
const COLLECTION = Symbol();
const RAW_SKIP = Symbol.for('elemix.raw');

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
        d = $__dep();
        map.set(key, d);
    }
    return d;
};

export const $__depOf = (obj: object, key: PropertyKey): Dep => {
    const t = (obj as Record<PropertyKey, unknown>)[RAW];
    return depFor((t as object) ?? obj, key);
};

export const $__toRaw = <T>(obj: T): T => {
    const t =
        obj == null ? undefined : (obj as Record<PropertyKey, unknown>)[RAW];
    return (t as T) ?? obj;
};

type Target = Record<PropertyKey, unknown>;

const hasOwn = Object.prototype.hasOwnProperty;

const objectHandler: ProxyHandler<Target> = {
    get(target, key) {
        if (key === RAW) return target;
        const value = target[key];
        if (value === null || typeof value !== 'object') {
            if (typeof key !== 'symbol') $__track(depFor(target, key));
            return value;
        }
        if (typeof key !== 'symbol') {
            $__track(depFor(target, key));
            if (Array.isArray(value)) $__track(depFor(value, ARRAY));
        }
        return $__reactive(value);
    },
    set(target, key, value) {
        const prev = target[key];
        if (prev === value) return true;
        target[key] = value;
        if (typeof key !== 'symbol') $__trigger(depFor(target, key));
        return true;
    },
};

const classHandler: ProxyHandler<Target> = {
    get(target, key, receiver) {
        if (key === RAW) return target;
        const value = hasOwn.call(target, key)
            ? target[key]
            : Reflect.get(target, key, receiver);
        if (value === null || typeof value !== 'object') {
            if (typeof key !== 'symbol') $__track(depFor(target, key));
            return value;
        }
        if (typeof key !== 'symbol') {
            $__track(depFor(target, key));
            if (Array.isArray(value)) $__track(depFor(value, ARRAY));
        }
        return $__reactive(value);
    },
    set(target, key, value) {
        const prev = target[key];
        if (prev === value) return true;
        target[key] = value;
        if (typeof key !== 'symbol') $__trigger(depFor(target, key));
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
                $__trigger(depFor(target, ARRAY));
                return result;
            };
        }
        const value = target[key];
        if (Array.isArray(value)) $__track(depFor(value, ARRAY));
        return $__reactive(value);
    },
    set(target, key, value) {
        const prev = target[key];
        target[key] = value;
        if (prev !== value) $__trigger(depFor(target, ARRAY));
        return true;
    },
};

const isCollection = (obj: object): boolean =>
    obj instanceof Map ||
    obj instanceof Set ||
    obj instanceof WeakMap ||
    obj instanceof WeakSet;

const iterate = (
    target: object,
    key: PropertyKey,
    pair: boolean,
): IterableIterator<unknown> => {
    $__track(depFor(target, COLLECTION));
    const inner = (target as Record<PropertyKey, () => Iterator<unknown>>)[
        key
    ]();
    return {
        next(): IteratorResult<unknown> {
            const step = inner.next();
            if (step.done) return step;
            const value = step.value;
            return {
                done: false,
                value: pair
                    ? [
                          $__reactive((value as unknown[])[0]),
                          $__reactive((value as unknown[])[1]),
                      ]
                    : $__reactive(value),
            };
        },
        [Symbol.iterator](): IterableIterator<unknown> {
            return this;
        },
    };
};

const collectionHandler: ProxyHandler<Target> = {
    get(target, key) {
        if (key === RAW) return target;
        const map = target as unknown as Map<unknown, unknown>;
        const isMapType = target instanceof Map || target instanceof WeakMap;

        switch (key) {
            case 'size':
                $__track(depFor(target, COLLECTION));
                return map.size;
            case 'get':
                return (k: unknown): unknown => {
                    $__track(depFor(target, COLLECTION));
                    return $__reactive(map.get(k));
                };
            case 'has':
                return (k: unknown): boolean => {
                    $__track(depFor(target, COLLECTION));
                    return map.has(k);
                };
            case 'add':
                return (v: unknown): unknown => {
                    if (!map.has(v)) {
                        (target as unknown as Set<unknown>).add(v);
                        $__trigger(depFor(target, COLLECTION));
                    }
                    return proxies.get(target);
                };
            case 'set':
                return (k: unknown, v: unknown): unknown => {
                    const had = map.has(k);
                    const prev = map.get(k);
                    if (!had || prev !== v) {
                        map.set(k, v);
                        $__trigger(depFor(target, COLLECTION));
                    }
                    return proxies.get(target);
                };
            case 'delete':
                return (k: unknown): boolean => {
                    const had = map.has(k);
                    const result = map.delete(k);
                    if (had) $__trigger(depFor(target, COLLECTION));
                    return result;
                };
            case 'clear':
                return (): void => {
                    if (map.size > 0) {
                        map.clear();
                        $__trigger(depFor(target, COLLECTION));
                    }
                };
            case 'forEach':
                return (
                    cb: (v: unknown, k: unknown, c: unknown) => void,
                    thisArg?: unknown,
                ): void => {
                    $__track(depFor(target, COLLECTION));
                    const proxy = proxies.get(target);
                    map.forEach((v, k) => {
                        cb.call(thisArg, $__reactive(v), $__reactive(k), proxy);
                    });
                };
            case 'keys':
                return (): IterableIterator<unknown> =>
                    iterate(target, 'keys', false);
            case 'values':
                return (): IterableIterator<unknown> =>
                    iterate(target, 'values', false);
            case 'entries':
                return (): IterableIterator<unknown> =>
                    iterate(target, 'entries', true);
            case Symbol.iterator:
                return (): IterableIterator<unknown> =>
                    iterate(target, Symbol.iterator, isMapType);
        }

        const value = (target as Target)[key];
        return typeof value === 'function' ? value.bind(target) : value;
    },
};

const isPlain = (obj: object): boolean => {
    const proto = Object.getPrototypeOf(obj);
    return proto === Object.prototype || proto === null;
};

const $__reactive = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const obj = value as Target;
    if (obj[RAW] !== undefined) return obj;
    const cached = proxies.get(obj);
    if (cached) return cached;
    if (obj[RAW_SKIP] === true) return obj;
    const handler = Array.isArray(obj)
        ? arrayHandler
        : isCollection(obj)
          ? collectionHandler
          : isPlain(obj)
            ? objectHandler
            : classHandler;
    const p = new Proxy(obj, handler);
    proxies.set(obj, p);
    return p;
};

export const $__state = <T extends object>(source: T): T =>
    $__reactive(source) as T;
