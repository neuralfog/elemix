import { describe, expect, it } from 'vitest';
import { $__moduleState, $__resetModuleStates } from '../src/runtime/hydrate';

describe('$__moduleState / $__resetModuleStates', () => {
    it('returns a reactive object and resets it in place', () => {
        const s = $__moduleState(() => ({ count: 0, nested: { x: 0 } }));
        s.count = 5;
        s.nested.x = 9;
        expect(s.count).toBe(5);

        $__resetModuleStates();
        expect(s.count).toBe(0);
        expect(s.nested.x).toBe(0);
    });

    it('keeps the same object reference across a reset', () => {
        const s = $__moduleState(() => ({ a: 1 }));
        const ref = s;
        s.a = 2;
        $__resetModuleStates();
        expect(s).toBe(ref);
        expect(s.a).toBe(1);
    });

    it('drops keys added at runtime when reset', () => {
        const s = $__moduleState(() => ({ a: 1 })) as Record<string, unknown>;
        s.extra = 'added';
        $__resetModuleStates();
        expect('extra' in s).toBe(false);
    });

    it('passes primitives through unregistered (reset never throws)', () => {
        const n = $__moduleState(() => 0);
        expect(n).toBe(0);
        expect(() => $__resetModuleStates()).not.toThrow();
    });
});
