import { $__island } from './island';
import { $__rootEffect } from './reactive';
import { $__moduleState } from './ssr';
import { $__reactive, $__toRaw } from './state';

let seed: Record<string, unknown> | undefined;
let seedPicked = false;

export const $__setStores = (
    data: Record<string, unknown> | undefined,
): void => {
    seed = data;
    seedPicked = true;
};

const COOKIE_PREFIX = 'store.';
const COOKIE_MAX_BYTES = 4096;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const writeCookie = (name: string, value: string): void => {
    const cookie = `${COOKIE_PREFIX}${name}=${encodeURIComponent(
        value,
    )}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    if (cookie.length > COOKIE_MAX_BYTES) {
        throw new Error(
            `store "${name}" exceeds the ${COOKIE_MAX_BYTES} byte cookie limit (${cookie.length}); keep client stores small and store larger data server-side`,
        );
    }
    document.cookie = cookie;
};

const flushQueue = new Map<string, string>();
let flushScheduled = false;

const flushCookies = (): void => {
    flushScheduled = false;
    const entries = [...flushQueue];
    flushQueue.clear();
    for (const [name, value] of entries) writeCookie(name, value);
};

const cookiePersist = (name: string, value: string): void => {
    flushQueue.set(name, value);
    if (!flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flushCookies);
    }
};

let persist: ((name: string, value: string) => void) | undefined =
    cookiePersist;

export const $__setStorePersister = (
    fn: (name: string, value: string) => void,
): void => {
    persist = fn;
};

const seedFor = (name: string): unknown => {
    if (!seedPicked && typeof window !== 'undefined') {
        seed = $__island<Record<string, unknown>>('__hydris_stores');
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
    $__moduleState(() => {
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
