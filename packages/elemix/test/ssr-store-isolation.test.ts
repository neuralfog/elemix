import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { $__moduleState, $__runStores } from '../src/runtime/ssr';
import {
    $__setStorePersister,
    $__setStores,
    $__store,
    $__stores,
} from '../src/runtime/store';

const ssrFlag = (on: boolean): void => {
    if (on) (globalThis as { __elemix_ssr?: boolean }).__elemix_ssr = true;
    else delete (globalThis as { __elemix_ssr?: boolean }).__elemix_ssr;
};

describe('SSR per-request module-state isolation', () => {
    beforeAll(() => ssrFlag(true));
    afterAll(() => ssrFlag(false));

    it('throws when module state is resolved outside $__runStores (loud, not a silent fallback leak)', () => {
        const s = $__moduleState(() => ({ n: 0 })) as { n: number };
        expect(() => s.n).toThrow(/\$__runStores/);
    });

    it('gives each request a fresh, isolated bag', () => {
        const s = $__moduleState(() => ({ n: 0 })) as { n: number };
        const a = $__runStores(() => {
            s.n = 1;
            return s.n;
        });
        const b = $__runStores(() => s.n);
        expect(a).toBe(1);
        expect(b).toBe(0);
    });

    it('re-seeds each store from its own request cookie (no cross-request store leak)', () => {
        const read = (cookie: Record<string, unknown>): number =>
            $__runStores(() => {
                $__setStores(cookie);
                const s = $__store('cart', () => ({ count: 0 })) as {
                    count: number;
                };
                const seen = s.count;
                s.count = 999;
                return seen;
            });
        expect(read({ cart: { count: 1 } })).toBe(1);
        expect(read({ cart: { count: 2 } })).toBe(2);
    });

    it('never wires client cookie persistence for stores during SSR (the window mock is not a client signal)', () => {
        const writes: Array<[string, string]> = [];
        $__setStorePersister((name, value) => writes.push([name, value]));
        $__runStores(() => {
            $__setStores({ cart: { count: 5 } });
            const cart = $__store('cart', () => ({ count: 0 })) as {
                count: number;
            };
            expect(cart.count).toBe(5);
            cart.count = 42;
            cart.count = 43;
        });
        expect(writes).toEqual([]);
    });
});

describe('client store persistence (genuinely off-server)', () => {
    beforeAll(() => ssrFlag(false));

    it('wires persistence and registry when not SSR', () => {
        const writes: Array<[string, string]> = [];
        $__setStorePersister((name, value) => writes.push([name, value]));
        const s = $__store('prefs', () => ({ theme: 'light' })) as {
            theme: string;
        };
        expect(s.theme).toBe('light');
        s.theme = 'dark';
        expect(writes.length).toBeGreaterThan(0);
        expect($__stores()).toHaveProperty('prefs');
    });
});
