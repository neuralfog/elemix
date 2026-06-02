import { describe, test, expect } from 'vitest';
import { mergeClasses } from '../../src/renderer/utils';

describe('mergeClasses', () => {
    test('merges two class strings', () => {
        expect(mergeClasses('foo', 'bar')).toBe('foo bar');
    });

    test('deduplicates classes', () => {
        expect(mergeClasses('foo bar', 'bar baz')).toBe('foo bar baz');
    });

    test('handles empty first string', () => {
        expect(mergeClasses('', 'foo bar')).toBe('foo bar');
    });

    test('handles empty second string', () => {
        expect(mergeClasses('foo bar', '')).toBe('foo bar');
    });

    test('handles both empty', () => {
        expect(mergeClasses('', '')).toBe('');
    });

    test('handles extra whitespace', () => {
        expect(mergeClasses('foo  bar', '  baz  ')).toBe('foo bar baz');
    });

    test('preserves insertion order', () => {
        expect(mergeClasses('a b c', 'd e f')).toBe('a b c d e f');
    });

    test('single class each', () => {
        expect(mergeClasses('foo', 'foo')).toBe('foo');
    });
});
