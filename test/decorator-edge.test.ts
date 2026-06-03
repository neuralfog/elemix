import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';

import type {
    PreExistingTag,
    RepeatedStateDecorator,
} from './fixtures/DecoratorEdge';

import './fixtures/DecoratorEdge';

describe('@component decorator — already-registered tag', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('does not throw when a custom element with the same tag is already defined', () => {
        // The fixture pre-registers `pre-existing-tag` outside the decorator,
        // then declares `PreExistingTag` through the decorator. If the guard in
        // define() didn't short-circuit, customElements.define would throw at
        // import time. Reaching this test at all proves the guard worked.
        expect(customElements.get('pre-existing-tag')).toBeDefined();
    });

    test('the decorator-decorated class can still render once registered', async () => {
        // Even though the tag is bound to the manually-registered placeholder
        // (not the decorated class), screen-mount + getComponent still resolve.
        const presenter = present().screen(
            html`<pre-existing-tag></pre-existing-tag>`,
        );
        await render();
        const el = presenter.root<PreExistingTag>();
        expect(el).toBeInstanceOf(HTMLElement);
    });
});

describe('@state decorator — duplicate application', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('stacking @state on the same property is idempotent', async () => {
        const presenter = present().screen(
            html`<repeated-state-decorator></repeated-state-decorator>`,
        );
        await render();
        const component = presenter.root<RepeatedStateDecorator>();
        expect(component.shadowRoot?.querySelector('span')?.textContent).toBe(
            'x',
        );
        component.data.value = 'y';
        await render();
        expect(component.shadowRoot?.querySelector('span')?.textContent).toBe(
            'y',
        );
    });
});
