import { describe, expect, it } from 'vitest';
import { type AssertionError, expect as x } from '../src/expect';

const thrown = (fn: () => void): AssertionError => {
    try {
        fn();
    } catch (e) {
        return e as AssertionError;
    }
    throw new Error('expected the assertion to throw');
};

const passes = (fn: () => void): void => {
    expect(fn).not.toThrow();
};

const fails = (fn: () => void): void => {
    expect(fn).toThrow();
};

describe('toBe', () => {
    it('passes on Object.is equality', () => {
        passes(() => x(1).toBe(1));
        passes(() => x('a').toBe('a'));
        const obj = {};
        passes(() => x(obj).toBe(obj));
        passes(() => x(Number.NaN).toBe(Number.NaN));
    });

    it('fails on inequality', () => {
        fails(() => x(1).toBe(2));
        fails(() => x({}).toBe({}));
    });

    it('negates', () => {
        passes(() => x(1).not.toBe(2));
        fails(() => x(1).not.toBe(1));
    });
});

describe('toEqual', () => {
    it('passes on deep structural equality', () => {
        passes(() => x([1, 2, 3]).toEqual([1, 2, 3]));
        passes(() => x({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } }));
        passes(() => x(new Date(0)).toEqual(new Date(0)));
    });

    it('fails on structural difference', () => {
        fails(() => x([1, 2]).toEqual([1, 2, 3]));
        fails(() => x({ a: 1 }).toEqual({ a: 2 }));
        fails(() => x({ a: 1 }).toEqual({ a: 1, b: 2 }));
    });

    it('distinguishes arrays from objects', () => {
        fails(() => x([]).toEqual({} as never));
    });

    it('negates', () => {
        passes(() => x([1]).not.toEqual([2]));
        fails(() => x([1]).not.toEqual([1]));
    });
});

describe('toContain', () => {
    it('matches a substring', () => {
        passes(() => x('hello world').toContain('world'));
        fails(() => x('hello').toContain('bye'));
    });

    it('matches an array member', () => {
        passes(() => x([1, 2, 3]).toContain(2));
        fails(() => x([1, 2, 3]).toContain(9));
    });

    it('negates', () => {
        passes(() => x('abc').not.toContain('z'));
        fails(() => x('abc').not.toContain('a'));
    });
});

describe('nullish matchers', () => {
    it('toBeNull', () => {
        passes(() => x(null).toBeNull());
        fails(() => x(undefined).toBeNull());
        fails(() => x(0).toBeNull());
    });

    it('toBeDefined', () => {
        passes(() => x(0).toBeDefined());
        passes(() => x(null).toBeDefined());
        fails(() => x(undefined).toBeDefined());
    });

    it('toBeUndefined', () => {
        passes(() => x(undefined).toBeUndefined());
        fails(() => x(null).toBeUndefined());
    });
});

describe('truthiness matchers', () => {
    it('toBeTruthy', () => {
        passes(() => x(1).toBeTruthy());
        passes(() => x('a').toBeTruthy());
        fails(() => x(0).toBeTruthy());
        fails(() => x('').toBeTruthy());
    });

    it('toBeFalsy', () => {
        passes(() => x(0).toBeFalsy());
        passes(() => x('').toBeFalsy());
        fails(() => x(1).toBeFalsy());
    });
});

describe('numeric matchers', () => {
    it('toBeGreaterThan', () => {
        passes(() => x(5).toBeGreaterThan(3));
        fails(() => x(3).toBeGreaterThan(5));
        fails(() => x(3).toBeGreaterThan(3));
    });

    it('toBeGreaterThanOrEqual', () => {
        passes(() => x(3).toBeGreaterThanOrEqual(3));
        fails(() => x(2).toBeGreaterThanOrEqual(3));
    });

    it('toBeLessThan', () => {
        passes(() => x(3).toBeLessThan(5));
        fails(() => x(5).toBeLessThan(3));
    });

    it('toBeLessThanOrEqual', () => {
        passes(() => x(3).toBeLessThanOrEqual(3));
        fails(() => x(5).toBeLessThanOrEqual(3));
    });
});

describe('error messages', () => {
    it('reads naturally for a positive assertion', () => {
        expect(() => x(1).toBe(2)).toThrowError('expected 1 to be 2');
    });

    it('reads naturally for a negated assertion', () => {
        expect(() => x(1).not.toBe(1)).toThrowError('expected 1 not to be 1');
    });

    it('quotes strings', () => {
        expect(() => x('a').toBe('b')).toThrowError('expected "a" to be "b"');
    });
});

describe('AssertionError diff metadata', () => {
    it('throws an AssertionError', () => {
        expect(thrown(() => x(1).toBe(2)).name).toBe('AssertionError');
    });

    it('carries actual/expected + showDiff for toBe', () => {
        const e = thrown(() => x(1).toBe(2));
        expect(e.actual).toBe(1);
        expect(e.expected).toBe(2);
        expect(e.showDiff).toBe(true);
    });

    it('carries actual/expected for toEqual', () => {
        const e = thrown(() => x([1, 2]).toEqual([1, 3]));
        expect(e.actual).toEqual([1, 2]);
        expect(e.expected).toEqual([1, 3]);
    });

    it('omits the diff on negated assertions', () => {
        const e = thrown(() => x(1).not.toBe(1));
        expect(e.expected).toBeUndefined();
        expect(e.showDiff).toBeUndefined();
    });

    it('omits the diff on non-equality matchers', () => {
        const e = thrown(() => x(1).toBeGreaterThan(5));
        expect(e.expected).toBeUndefined();
    });
});
