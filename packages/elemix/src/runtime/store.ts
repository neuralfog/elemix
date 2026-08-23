import { $__rootEffect } from './reactive';
import { $__scopedStore } from './ssr';
import { $__reactive, $__toRaw } from './state';

let seed: Record<string, unknown> | undefined;
let seedPicked = false;
let persist: ((name: string, value: string) => void) | undefined;

export const $__setStores = (
    data: Record<string, unknown> | undefined,
): void => {
    seed = data;
    seedPicked = true;
};

export const $__setStorePersister = (
    fn: (name: string, value: string) => void,
): void => {
    persist = fn;
};

const seedFor = (name: string): unknown => {
    if (!seedPicked && typeof window !== 'undefined') {
        seed = (window as { __hydris_stores?: Record<string, unknown> })
            .__hydris_stores;
        seedPicked = true;
    }
    return seed?.[name];
};

const registry = new Map<string, object>();

export const $__stores = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [name, store] of registry) out[name] = $__toRaw(store);
    return out;
};

export const $__store = <T extends object>(name: string, factory: () => T): T =>
    $__scopedStore(() => {
        const base = factory();
        const override = seedFor(name);
        const initial =
            override !== null &&
            typeof override === 'object' &&
            !Array.isArray(override)
                ? { ...base, ...(override as Record<string, unknown>) }
                : base;
        const store = $__reactive(initial) as T;
        if (typeof window !== 'undefined') {
            registry.set(name, store as object);
            let primed = false;
            $__rootEffect(() => {
                const snapshot = JSON.stringify(store);
                if (primed) persist?.(name, snapshot);
                else primed = true;
            });
        }
        return store;
    });

export const store = <T extends object>(name: string, initial: T): T =>
    $__store(name, () => initial);
