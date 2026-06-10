import { track, trigger, type Scope } from './reactive';

const observed = new WeakSet<object>();

const MUTATORS = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
] as const;

const observeArray = (arr: unknown[], subs: Set<Scope>): void => {
    if (observed.has(arr)) return;
    observed.add(arr);
    for (let i = 0; i < arr.length; i++) observe(arr[i]);
    for (const name of MUTATORS) {
        const original = Array.prototype[name] as (
            ...args: unknown[]
        ) => unknown;
        Object.defineProperty(arr, name, {
            enumerable: false,
            configurable: true,
            writable: true,
            value(this: unknown[], ...args: unknown[]): unknown {
                const result = original.apply(this, args);
                for (let i = 0; i < this.length; i++) observe(this[i]);
                trigger(subs);
                return result;
            },
        });
    }
};

const observe = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) return;
    if (observed.has(value)) return;
    observed.add(value);
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
        let val = obj[key];
        const subs = new Set<Scope>();
        if (Array.isArray(val)) observeArray(val, subs);
        else observe(val);
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                track(subs);
                return val;
            },
            set(next: unknown): void {
                if (val === next) return;
                if (Array.isArray(next)) observeArray(next, subs);
                else observe(next);
                val = next;
                trigger(subs);
            },
        });
    }
};

export const state = <T extends object>(source: T): T => {
    observe(source);
    return source;
};
