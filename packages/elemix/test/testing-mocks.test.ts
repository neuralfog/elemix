import { expect, test, describe, beforeEach } from 'vitest';
import { MockCSSStyleSheet } from '../testing/mocks';

describe('MockCSSStyleSheet', () => {
    let sheet: MockCSSStyleSheet;

    beforeEach(() => {
        sheet = new MockCSSStyleSheet();
    });

    test('initializes with an empty cssRules list', () => {
        expect(sheet.cssRules).toEqual([]);
    });

    describe('insertRule', () => {
        test('appends a rule when no index is given and returns its position', () => {
            const a = sheet.insertRule('.a { color: red; }');
            const b = sheet.insertRule('.b { color: blue; }');
            expect(a).toBe(0);
            expect(b).toBe(1);
            expect(sheet.cssRules).toHaveLength(2);
            expect(sheet.cssRules[0].cssText).toBe('.a { color: red; }');
            expect(sheet.cssRules[1].cssText).toBe('.b { color: blue; }');
        });

        test('inserts at the explicit position', () => {
            sheet.insertRule('.a { color: red; }');
            sheet.insertRule('.b { color: blue; }');
            const idx = sheet.insertRule('.c { color: green; }', 1);
            expect(idx).toBe(1);
            expect(sheet.cssRules.map((r) => r.cssText)).toEqual([
                '.a { color: red; }',
                '.c { color: green; }',
                '.b { color: blue; }',
            ]);
        });

        test('throws RangeError for negative index', () => {
            expect(() => sheet.insertRule('.a { }', -1)).toThrow(RangeError);
        });

        test('throws RangeError for index past the end', () => {
            expect(() => sheet.insertRule('.a { }', 5)).toThrow(RangeError);
        });

        test('attaches the standard CSSRule shape to inserted rules', () => {
            sheet.insertRule('.a { color: red; }');
            const rule = sheet.cssRules[0];
            expect(rule.cssText).toBe('.a { color: red; }');
            expect(rule.parentRule).toBeNull();
            expect(rule.parentStyleSheet).toBeNull();
            expect(rule.type).toBe(CSSRule.STYLE_RULE);
        });
    });

    describe('deleteRule', () => {
        test('removes the rule at the given position', () => {
            sheet.insertRule('.a { }');
            sheet.insertRule('.b { }');
            sheet.insertRule('.c { }');
            sheet.deleteRule(1);
            expect(sheet.cssRules.map((r) => r.cssText)).toEqual([
                '.a { }',
                '.c { }',
            ]);
        });

        test('throws RangeError for negative index', () => {
            sheet.insertRule('.a { }');
            expect(() => sheet.deleteRule(-1)).toThrow(RangeError);
        });

        test('throws RangeError for index at or past length', () => {
            sheet.insertRule('.a { }');
            expect(() => sheet.deleteRule(1)).toThrow(RangeError);
            expect(() => sheet.deleteRule(99)).toThrow(RangeError);
        });
    });

    describe('replaceSync', () => {
        test('splits text into rules at `}` boundaries', () => {
            sheet.replaceSync('.a { color: red; } .b { color: blue; }');
            expect(sheet.cssRules).toHaveLength(2);
            expect(sheet.cssRules[0].cssText).toBe('.a { color: red; }');
            expect(sheet.cssRules[1].cssText).toBe('.b { color: blue; }');
        });

        test('replaces any prior rules entirely', () => {
            sheet.insertRule('.first { }');
            sheet.replaceSync('.fresh { color: green; }');
            expect(sheet.cssRules).toHaveLength(1);
            expect(sheet.cssRules[0].cssText).toBe('.fresh { color: green; }');
        });

        test('drops empty / whitespace-only fragments', () => {
            sheet.replaceSync('.a { } \n\n .b { }');
            expect(sheet.cssRules).toHaveLength(2);
        });

        test('handles an empty input string by clearing the rule list', () => {
            sheet.insertRule('.first { }');
            sheet.replaceSync('');
            expect(sheet.cssRules).toEqual([]);
        });
    });
});
