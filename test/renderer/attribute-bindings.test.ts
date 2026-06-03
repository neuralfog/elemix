import { describe, test, expect, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';

class PropEl extends HTMLElement {
    $props = new Map<string, unknown>();
}

customElements.define('prop-el', PropEl);

describe('Attribute Bindings', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('standard attributes', () => {
        test('sets string attribute', () => {
            const presenter = present().screen(
                html`<div id=${'test-id'}></div>`,
            );
            expect(presenter.getComponent<HTMLDivElement>('div').id).toBe(
                'test-id',
            );
        });

        test('updates on re-render', () => {
            const presenter = present();
            const t = (id: string) => html`<div id=${id}></div>`;
            presenter.screen(t('first'));
            presenter.screen(t('second'));
            expect(presenter.getComponent<HTMLDivElement>('div').id).toBe(
                'second',
            );
        });

        test('skips update when value unchanged', () => {
            const presenter = present();
            const t = (id: string) => html`<div id=${id}></div>`;
            presenter.screen(t('same'));
            presenter.screen(t('same'));
            expect(presenter.getComponent<HTMLDivElement>('div').id).toBe(
                'same',
            );
        });
    });

    describe('.class', () => {
        test('sets class from string', () => {
            const presenter = present().screen(
                html`<div .class=${'active'}></div>`,
            );
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('active');
        });

        test('sets class from object with boolean flags', () => {
            const presenter = present().screen(
                html`<div .class=${{ active: true, disabled: false, visible: true }}></div>`,
            );
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('active visible');
        });

        test('merges with initial class', () => {
            const presenter = present().screen(
                html`<div class="base" .class=${'extra'}></div>`,
            );
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('base extra');
        });

        test('resets to initial class when null', () => {
            const presenter = present();
            const t = (cls: unknown) =>
                html`<div class="base" .class=${cls}></div>`;
            presenter.screen(t('extra'));
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('base extra');
            presenter.screen(t(null));
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('base');
        });

        test('updates class on re-render', () => {
            const presenter = present();
            const t = (cls: string) => html`<div .class=${cls}></div>`;
            presenter.screen(t('foo'));
            presenter.screen(t('bar'));
            expect(
                presenter.getComponent<HTMLDivElement>('div').className,
            ).toBe('bar');
        });
    });

    describe(':prop', () => {
        test('sets prop via $props.set', () => {
            const presenter = present().screen(
                html`<prop-el :color=${'red'}></prop-el>`,
            );
            expect(
                presenter.getComponent<PropEl>('prop-el').$props.get('color'),
            ).toBe('red');
        });
    });
});
