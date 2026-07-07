import { describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import { defineComponent } from '../src/runtime/dom';

class CloakEl extends Component {}
defineComponent('cloak-el', CloakEl);

const mount = (tag: string): Element => {
    document.body.insertAdjacentHTML('beforeend', `<${tag}></${tag}>`);
    const els = document.body.querySelectorAll(tag);
    return els[els.length - 1];
};

describe('cloak (default)', () => {
    test('data-cloak is gone once the element has mounted', () => {
        const el = mount('cloak-el');
        expect(el.hasAttribute('data-cloak')).toBe(false);
    });

    test('adopts one shared cloak sheet into the document', () => {
        mount('cloak-el');
        mount('cloak-el');
        expect(document.adoptedStyleSheets.length).toBe(1);
        expect(document.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
    });

    test('does not pollute the component shadow root', () => {
        const el = mount('cloak-el') as CloakEl;
        expect(el.shadowRoot?.adoptedStyleSheets?.length ?? 0).toBe(0);
    });
});
