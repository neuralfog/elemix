import { describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import { $__defineComponent as defineComponent } from '../src/runtime/dom';

window.__elemix__ = { config: { shadow: false } };

class LightByDefault extends Component {}
defineComponent('cfg-light', LightByDefault);

class ForcedShadow extends Component {
    static __shadow = true;
}
defineComponent('cfg-forced-shadow', ForcedShadow);

const mount = (tag: string): Element => {
    document.body.insertAdjacentHTML('beforeend', `<${tag}></${tag}>`);
    const els = document.body.querySelectorAll(tag);
    return els[els.length - 1];
};

describe('shadow resolution (config shadow: false)', () => {
    test('components default to light DOM', () => {
        expect(mount('cfg-light').shadowRoot).toBeNull();
    });

    test('#shadow overrides the light-DOM default', () => {
        expect(mount('cfg-forced-shadow').shadowRoot).not.toBeNull();
    });
});
