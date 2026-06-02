import { describe, test, expect, beforeEach, vi } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '@neuralfog/elemix-testing';

describe('Event Bindings', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('@event', () => {
        test('binds click handler', () => {
            const handler = vi.fn();
            const presenter = present().screen(
                html`<button @click=${handler}>Click</button>`,
            );
            presenter.getComponent<HTMLButtonElement>('button').click();
            expect(handler).toHaveBeenCalledOnce();
        });

        test('binds input handler', () => {
            const handler = vi.fn();
            const presenter = present().screen(html`<input @input=${handler}>`);
            presenter
                .getComponent<HTMLInputElement>('input')
                .dispatchEvent(new Event('input'));
            expect(handler).toHaveBeenCalledOnce();
        });

        test('updates handler on re-render', () => {
            const first = vi.fn();
            const second = vi.fn();
            const presenter = present();
            const t = (h: () => void) =>
                html`<button @click=${h}>Click</button>`;

            presenter.screen(t(first));
            presenter.screen(t(second));
            presenter.getComponent<HTMLButtonElement>('button').click();

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledOnce();
        });

        test('removes virtual attribute from DOM', () => {
            const presenter = present().screen(
                html`<button @click=${() => {}}>Click</button>`,
            );
            expect(
                presenter
                    .getComponent<HTMLButtonElement>('button')
                    .hasAttribute('@click'),
            ).toBe(false);
        });
    });

    describe('.bind-events', () => {
        test('binds multiple handlers from object', () => {
            const onClick = vi.fn();
            const onMouseover = vi.fn();
            const presenter = present().screen(
                html`<div .bind-events=${{ click: onClick, mouseover: onMouseover }}></div>`,
            );
            const div = presenter.getComponent<HTMLDivElement>('div');
            div.click();
            div.dispatchEvent(new Event('mouseover'));
            expect(onClick).toHaveBeenCalledOnce();
            expect(onMouseover).toHaveBeenCalledOnce();
        });

        test('does not rebind unchanged handler', () => {
            const handler = vi.fn();
            const presenter = present();
            const t = () =>
                html`<div .bind-events=${{ click: handler }}></div>`;
            presenter.screen(t());
            presenter.screen(t());
            presenter.getComponent<HTMLDivElement>('div').click();
            expect(handler).toHaveBeenCalledOnce();
        });
    });
});
