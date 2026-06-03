import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';
import { render } from '../../utilities';
import { HTML } from '../../testing/snapshots';

import type {
    DirectPropHost,
    DirectPropObject,
} from '../fixtures/renderer/DirectProp';
import '../fixtures/renderer/DirectProp';

describe('`.prop=${value}` direct property assignment', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('sets the property on the DOM node and removes the source attribute', async () => {
        const presenter = present().screen(
            html`<direct-prop-host></direct-prop-host>`,
        );
        const c = presenter.root<DirectPropHost>();
        c.inputValue = 'hello';
        c.flag = true;
        c.count = 3;
        c.render();
        await render();

        const input = c.shadowRoot?.querySelector('input') as HTMLInputElement;
        expect(input).not.toBeNull();
        // properties are written, not attributes
        expect(input.value).toBe('hello');
        expect(input.disabled).toBe(true);
        expect(input.tabIndex).toBe(3);
        // and the original `.foo` attribute is removed (virtual hole)
        expect(input.hasAttribute('.value')).toBe(false);
        expect(input.hasAttribute('.disabled')).toBe(false);
        expect(input.hasAttribute('.tabIndex')).toBe(false);
    });

    test('updates the property on re-render when the value changes', async () => {
        const presenter = present().screen(
            html`<direct-prop-host></direct-prop-host>`,
        );
        const c = presenter.root<DirectPropHost>();
        c.inputValue = 'first';
        c.render();
        await render();

        const input = c.shadowRoot?.querySelector('input') as HTMLInputElement;
        expect(input.value).toBe('first');

        c.inputValue = 'second';
        c.render();
        await render();
        expect(input.value).toBe('second');

        c.inputValue = '';
        c.render();
        await render();
        expect(input.value).toBe('');
    });

    test('dedupes identical values across re-renders', async () => {
        const presenter = present().screen(
            html`<direct-prop-host></direct-prop-host>`,
        );
        const c = presenter.root<DirectPropHost>();
        c.inputValue = 'same';
        c.render();
        await render();

        const input = c.shadowRoot?.querySelector('input') as HTMLInputElement;

        // Override the property setter to detect re-assignments.
        let setCount = 0;
        const proto = Object.getPrototypeOf(input);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        Object.defineProperty(input, 'value', {
            configurable: true,
            get(): string {
                return desc?.get?.call(input) ?? '';
            },
            set(v: string): void {
                setCount += 1;
                desc?.set?.call(input, v);
            },
        });

        // Re-render with the same value — directPropHole should short-circuit.
        c.render();
        await render();
        c.render();
        await render();
        expect(setCount).toBe(0);

        // Now change the value — should fire exactly once.
        c.inputValue = 'changed';
        c.render();
        await render();
        expect(setCount).toBe(1);
    });

    test('passes object values straight through to the property', async () => {
        const presenter = present().screen(
            html`<direct-prop-object></direct-prop-object>`,
        );
        const c = presenter.root<DirectPropObject>();
        await render();

        const receiver = c.shadowRoot?.querySelector('x-receiver') as Element &
            Record<string, unknown>;
        expect(receiver).not.toBeNull();
        expect(receiver.data).toEqual({ foo: 'bar' });
        expect(receiver.hasAttribute('.data')).toBe(false);

        const next = { foo: 'baz', n: 42 };
        c.payload = next;
        c.render();
        await render();
        expect(receiver.data).toBe(next);
    });

    test('rendered shadow snapshot has no `.prop` attributes left behind', async () => {
        const presenter = present().screen(
            html`<direct-prop-host></direct-prop-host>`,
        );
        const c = presenter.root<DirectPropHost>();
        c.inputValue = 'snapshot';
        c.flag = true;
        c.count = 7;
        c.render();
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
