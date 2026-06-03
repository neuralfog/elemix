import { expect, test, describe } from 'vitest';
import { ref, fastUID, camelToKebabCase } from '../utilities';

describe('ref', () => {
    test('returns a wrapper with undefined when called with no argument', () => {
        const r = ref();
        expect(r).toEqual({ value: undefined });
    });

    test('seeds the wrapper with the value passed in', () => {
        const r = ref('hello');
        expect(r).toEqual({ value: 'hello' });
    });

    test('typed ref carries the supplied object value', () => {
        const r = ref<{ x: number }>({ x: 42 });
        expect(r.value).toEqual({ x: 42 });
    });
});

describe('fastUID', () => {
    test('returns a non-empty string', () => {
        const id = fastUID();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('successive calls produce distinct ids', () => {
        const seen = new Set<string>();
        for (let i = 0; i < 50; i++) seen.add(fastUID());
        expect(seen.size).toBe(50);
    });
});

describe('camelToKebabCase', () => {
    test('converts simple camelCase', () => {
        expect(camelToKebabCase('helloWorld')).toBe('hello-world');
    });

    test('converts PascalCase', () => {
        expect(camelToKebabCase('HelloWorld')).toBe('hello-world');
    });

    test('handles consecutive uppercase letters (acronyms)', () => {
        expect(camelToKebabCase('APIResponse')).toBe('api-response');
        expect(camelToKebabCase('parseURL')).toBe('parse-url');
    });

    test('preserves and lowercases digits', () => {
        expect(camelToKebabCase('user42Score')).toBe('user-42-score');
    });

    test('returns empty string for empty input', () => {
        expect(camelToKebabCase('')).toBe('');
    });

    test('handles single lowercase word', () => {
        expect(camelToKebabCase('button')).toBe('button');
    });
});
