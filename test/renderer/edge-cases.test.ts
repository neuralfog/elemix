import { describe, test, expect, beforeEach } from 'vitest';
import { html, render } from '@neuralfog/elemix-renderer';
import { present } from '@neuralfog/elemix-testing';

describe('Edge Cases', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('null and undefined in text holes', () => {
        test('null renders empty string', () => {
            const presenter = present().screen(html`<div>${null}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('');
        });

        test('undefined renders empty string', () => {
            const presenter = present().screen(html`<div>${undefined}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('');
        });

        test('number renders as string', () => {
            const presenter = present().screen(html`<div>${42}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('42');
        });

        test('boolean renders as string', () => {
            const presenter = present().screen(html`<div>${true}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('true');
        });

        test('zero renders as string', () => {
            const presenter = present().screen(html`<div>${0}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('0');
        });

        test('empty string renders empty', () => {
            const presenter = present().screen(html`<div>${''}</div>`);
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('');
        });
    });

    describe('error handling', () => {
        test('render to null container throws', () => {
            expect(() => render(html`<div></div>`, null)).toThrow(
                'render method needs to accept instance of HTMLElement',
            );
        });
    });

    describe('re-render behavior', () => {
        test('updates text content on re-render', () => {
            const presenter = present();
            const t = (val: string) => html`<div>${val}</div>`;
            presenter.screen(t('hello'));
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('hello');
            presenter.screen(t('world'));
            expect(
                presenter.getComponent<HTMLDivElement>('div').textContent,
            ).toBe('world');
        });

        test('preserves DOM node identity on re-render', () => {
            const presenter = present();
            const t = (val: string) => html`<div>${val}</div>`;
            presenter.screen(t('hello'));
            const div = presenter.getComponent<HTMLDivElement>('div');
            presenter.screen(t('world'));
            expect(presenter.getComponent<HTMLDivElement>('div')).toBe(div);
        });

        test('switches nested template on re-render', () => {
            const presenter = present();
            const t = (flag: boolean) =>
                html`<div>${flag ? html`<span>A</span>` : html`<span>B</span>`}</div>`;
            presenter.screen(t(true));
            expect(
                presenter.getComponent<HTMLSpanElement>('span').textContent,
            ).toBe('A');
            presenter.screen(t(false));
            expect(
                presenter.getComponent<HTMLSpanElement>('span').textContent,
            ).toBe('B');
        });

        test('multiple interpolations update independently', () => {
            const presenter = present();
            const t = (a: string, b: string) =>
                html`<div><span>${a}</span><span>${b}</span></div>`;
            presenter.screen(t('hello', 'world'));
            const spans = presenter.body().querySelectorAll('span');
            expect(spans[0].textContent).toBe('hello');
            expect(spans[1].textContent).toBe('world');
            presenter.screen(t('foo', 'bar'));
            expect(spans[0].textContent).toBe('foo');
            expect(spans[1].textContent).toBe('bar');
        });
    });
});
