import { describe, expect, test } from 'vitest';
import { $__bind as bind, $__effect as effect } from '../src/runtime/reactive';
import { $__depOf as depOf, $__state as state } from '../src/runtime/state';

describe('compile-reactivity primitives (depOf + bind)', () => {
    test('bind subscribes to a depOf dep and re-runs on a Proxy write', () => {
        const s = state({ count: 0 });
        let runs = 0;
        bind(() => {
            runs++;
        }, [depOf(s, 'count')]);
        expect(runs).toBe(1);
        s.count = 1;
        expect(runs).toBe(2);
        s.count = 1;
        expect(runs).toBe(2);
        s.count = 2;
        expect(runs).toBe(3);
    });

    test('bind re-runs only for its own deps, not sibling fields', () => {
        const s = state({ a: 0, b: 0 });
        let runs = 0;
        bind(() => {
            runs++;
        }, [depOf(s, 'a')]);
        expect(runs).toBe(1);
        s.b = 9;
        expect(runs).toBe(1);
        s.a = 9;
        expect(runs).toBe(2);
    });

    test('depOf resolves the same Dep from the proxy or the raw object', () => {
        const raw = { x: 1 };
        const s = state(raw);
        expect(depOf(s, 'x')).toBe(depOf(raw, 'x'));
    });

    test('a raw-reading updater stays fixed to its declared deps', () => {
        const raw = { a: 1, b: 1 };
        const s = state(raw);
        const seen: number[] = [];
        bind(() => {
            seen.push(raw.a + raw.b);
        }, [depOf(s, 'a')]);
        s.b = 100;
        expect(seen).toEqual([2]);
        s.a = 100;
        expect(seen).toEqual([2, 200]);
    });
});

describe('dynamic dependency sets', () => {
    test('a conditional dep set prunes the stale branch', () => {
        const s = state({ cond: true, a: 0, b: 0 });
        const seen: number[] = [];
        effect(() => {
            seen.push(s.cond ? s.a : s.b);
        });
        expect(seen).toEqual([0]);
        s.b = 5;
        expect(seen).toEqual([0]);
        s.a = 1;
        expect(seen).toEqual([0, 1]);
        s.cond = false;
        expect(seen).toEqual([0, 1, 5]);
        s.a = 99;
        expect(seen).toEqual([0, 1, 5]);
        s.b = 6;
        expect(seen).toEqual([0, 1, 5, 6]);
    });

    test('duplicate reads of one dep trigger a single re-run', () => {
        const s = state({ a: 1 });
        let runs = 0;
        effect(() => {
            runs++;
            void (s.a + s.a + s.a);
        });
        expect(runs).toBe(1);
        s.a = 2;
        expect(runs).toBe(2);
    });

    test('a growing dep set subscribes to newly-read deps', () => {
        const s = state({ a: 0, b: 0, grow: false });
        const seen: number[] = [];
        effect(() => {
            seen.push(s.grow ? s.a + s.b : s.a);
        });
        expect(seen).toEqual([0]);
        s.b = 7;
        expect(seen).toEqual([0]);
        s.grow = true;
        expect(seen).toEqual([0, 7]);
        s.b = 8;
        expect(seen).toEqual([0, 7, 8]);
    });

    test('a stable effect keeps reacting across many runs', () => {
        const s = state({ a: 0, b: 0 });
        const seen: number[] = [];
        effect(() => {
            seen.push(s.a + s.b);
        });
        for (let i = 1; i <= 5; i++) s.a = i;
        s.b = 10;
        expect(seen).toEqual([0, 1, 2, 3, 4, 5, 15]);
    });

    test('reordered reads still track both deps', () => {
        const s = state({ flip: false, a: 0, b: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            if (s.flip) {
                void s.b;
                void s.a;
            } else {
                void s.a;
                void s.b;
            }
        });
        expect(runs).toBe(1);
        s.flip = true;
        expect(runs).toBe(2);
        s.a = 1;
        expect(runs).toBe(3);
        s.b = 1;
        expect(runs).toBe(4);
    });
});

describe('effect self-recursion guard', () => {
    test('an effect that writes a dep it reads does not loop on its own write', () => {
        const s = state({ count: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            s.count = s.count + 1;
        });
        expect(runs).toBe(1);
        expect(s.count).toBe(1);
    });

    test('the guard suppresses only self-trigger, not external changes', () => {
        const s = state({ count: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            s.count = s.count + 1;
        });
        expect(runs).toBe(1);
        s.count = 10;
        expect(runs).toBe(2);
        expect(s.count).toBe(11);
    });
});
