import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';

import type {
    OnModelClampApp,
    OnModelOnlyApp,
    OnModelOrderApp,
} from './fixtures/OnModelBinding';
import './fixtures/OnModelBinding';

const fireInput = (input: HTMLInputElement, value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('~onmodel hole', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('callback transforms input value before write to model', async () => {
        const presenter = present().screen(
            html`<on-model-clamp-app></on-model-clamp-app>`,
        );
        const app = presenter.root<OnModelClampApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');

        fireInput(input, '150');
        await render();

        expect(app.state.input.value).toBe('100');
        expect(input.value).toBe('100');
    });

    test('callback clamps low end', async () => {
        const presenter = present().screen(
            html`<on-model-clamp-app></on-model-clamp-app>`,
        );
        const app = presenter.root<OnModelClampApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');

        fireInput(input, '-50');
        await render();

        expect(app.state.input.value).toBe('0');
        expect(input.value).toBe('0');
    });

    test('callback passes through valid values unchanged', async () => {
        const presenter = present().screen(
            html`<on-model-clamp-app></on-model-clamp-app>`,
        );
        const app = presenter.root<OnModelClampApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');

        fireInput(input, '42');
        await render();

        expect(app.state.input.value).toBe('42');
        expect(input.value).toBe('42');
    });

    test('callback fires on every input event', async () => {
        const presenter = present().screen(
            html`<on-model-clamp-app></on-model-clamp-app>`,
        );
        const app = presenter.root<OnModelClampApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');

        fireInput(input, '200');
        await render();
        expect(app.state.input.value).toBe('100');

        fireInput(input, '50');
        await render();
        expect(app.state.input.value).toBe('50');

        fireInput(input, '-10');
        await render();
        expect(app.state.input.value).toBe('0');
    });

    test('attribute order does not matter (~onmodel before ~model)', async () => {
        const presenter = present().screen(
            html`<on-model-order-app></on-model-order-app>`,
        );
        const app = presenter.root<OnModelOrderApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');

        fireInput(input, '999');
        await render();

        expect(app.state.input.value).toBe('100');
        expect(input.value).toBe('100');
    });

    test('virtual ~onmodel attribute is stripped from the DOM', async () => {
        const presenter = present().screen(
            html`<on-model-clamp-app></on-model-clamp-app>`,
        );
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');
        expect(input.hasAttribute('~onmodel')).toBe(false);
    });

    test('~onmodel without ~model does not fire on input', async () => {
        const presenter = present().screen(
            html`<on-model-only-app></on-model-only-app>`,
        );
        const app = presenter.root<OnModelOnlyApp>();
        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');
        fireInput(input, 'anything');
        await render();

        expect(app.calls).toEqual([]);
    });
});
