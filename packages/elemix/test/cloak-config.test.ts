import { describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import { defineComponent } from '../src/runtime/dom';

window.__elemix__ = { config: { cloak: 'app-root{opacity:0}' } };

class OverrideEl extends Component {}
defineComponent('override-el', OverrideEl);

const ruleText = (s: CSSStyleSheet): string =>
    Array.from(s.cssRules)
        .map((r) => r.cssText)
        .join('');

describe('cloak (config override)', () => {
    test('uses the cloak CSS string from window config', () => {
        document.body.insertAdjacentHTML(
            'beforeend',
            '<override-el></override-el>',
        );
        const sheet = document.adoptedStyleSheets[0];
        expect(sheet).toBeInstanceOf(CSSStyleSheet);
        expect(ruleText(sheet)).toContain('app-root');
        expect(ruleText(sheet)).toContain('opacity: 0');
    });
});
