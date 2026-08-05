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
