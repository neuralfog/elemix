import { describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import { $__defineComponent as defineComponent } from '../src/runtime/dom';

class DefaultEl extends Component {}
defineComponent('shadow-default', DefaultEl);

class NoShadowEl extends Component {
    static __noShadow = true;
}
defineComponent('shadow-none', NoShadowEl);

class ForcedShadowEl extends Component {
    static __shadow = true;
}
defineComponent('shadow-forced', ForcedShadowEl);

const mount = (tag: string): Element => {
    document.body.insertAdjacentHTML('beforeend', `<${tag}></${tag}>`);
    const els = document.body.querySelectorAll(tag);
    return els[els.length - 1];
};

describe('shadow resolution (default config)', () => {
    test('a plain component attaches a shadow root', () => {
        expect(mount('shadow-default').shadowRoot).not.toBeNull();
    });

    test('#no-shadow (__noShadow) renders to light DOM', () => {
        expect(mount('shadow-none').shadowRoot).toBeNull();
    });

    test('#shadow (__shadow) attaches a shadow root', () => {
        expect(mount('shadow-forced').shadowRoot).not.toBeNull();
    });
});
