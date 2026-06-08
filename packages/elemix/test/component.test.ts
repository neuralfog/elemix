import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';
import { makeCssStylesheet } from '../src/utilities';

import type {
    MultiStyledHost,
    SlotHost,
    StyledHost,
    UnstyledHost,
} from './fixtures/StyledHost';

import './fixtures/StyledHost';

describe('Component — controlStyles getter and setter', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('controlStyles returns an empty array by default', async () => {
        const presenter = present().screen(
            html`<unstyled-host></unstyled-host>`,
        );
        await render();
        const component = presenter.root<UnstyledHost>();
        expect(component.controlStyles).toEqual([]);
    });

    test('setControlStyles stores sheets and controlStyles returns them', async () => {
        const presenter = present().screen(
            html`<unstyled-host></unstyled-host>`,
        );
        await render();
        const component = presenter.root<UnstyledHost>();

        const sheets = [
            makeCssStylesheet('div { color: green; }'),
            makeCssStylesheet('span { font-weight: bold; }'),
        ];
        component.setControlStyles(sheets);

        expect(component.controlStyles).toBe(sheets);
        expect(component.controlStyles).toHaveLength(2);
    });
});

describe('Component — styles getter', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('styles getter returns the Styles instance with the declared styles', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await render();
        const component = presenter.root<StyledHost>();
        expect(component.styles.styles).toEqual([
            '.styled-host { color: red; }',
        ]);
    });
});

describe('Component — hasSlot', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('returns true when a child has matching slot attribute', async () => {
        const presenter = present().screen(html`
            <slot-host>
                <span slot="icon">★</span>
                <span slot="text">Hello</span>
            </slot-host>
        `);
        await render();
        const component = presenter.root<SlotHost>();
        expect(component.hasSlot('icon')).toBe(true);
        expect(component.hasSlot('text')).toBe(true);
    });

    test('returns false for slot names that no child claims', async () => {
        const presenter = present().screen(html`
            <slot-host>
                <span slot="icon">★</span>
            </slot-host>
        `);
        await render();
        const component = presenter.root<SlotHost>();
        expect(component.hasSlot('text')).toBe(false);
        expect(component.hasSlot('trailing')).toBe(false);
    });

    test('returns false when the component has no slotted children at all', async () => {
        const presenter = present().screen(html`<slot-host></slot-host>`);
        await render();
        const component = presenter.root<SlotHost>();
        expect(component.hasSlot('icon')).toBe(false);
        expect(component.hasSlot('text')).toBe(false);
    });
});

describe('Styles — adoptedStyleSheets wiring', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('component with no styles leaves adoptedStyleSheets untouched', async () => {
        const presenter = present().screen(
            html`<unstyled-host></unstyled-host>`,
        );
        await render();
        const component = presenter.root<UnstyledHost>();
        // initialize() short-circuits when styles array is empty, so the
        // shadow root's adoptedStyleSheets is never assigned.
        expect(component.shadowRoot?.adoptedStyleSheets).toBeUndefined();
    });

    test('component with declared styles attaches a single sheet to its shadow root', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await render();
        const component = presenter.root<StyledHost>();
        const sheets = component.shadowRoot?.adoptedStyleSheets ?? [];
        expect(sheets).toHaveLength(1);
    });

    test('multiple declared style strings are concatenated into one sheet', async () => {
        const presenter = present().screen(
            html`<multi-styled-host></multi-styled-host>`,
        );
        await render();
        const component = presenter.root<MultiStyledHost>();
        const sheets = component.shadowRoot?.adoptedStyleSheets ?? [];
        expect(sheets).toHaveLength(1);
    });

    test('controlStyles set before connect are appended after the main sheet', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await render();
        const component = presenter.root<StyledHost>();
        const controlSheet = makeCssStylesheet('div { padding: 1rem; }');

        // The constructor-time controlStyles read is empty on first render;
        // we re-trigger style initialization by calling it directly to verify
        // that controlStyles values flow through the adoption list.
        component.setControlStyles([controlSheet]);
        component.styles.initialize();

        const sheets = component.shadowRoot?.adoptedStyleSheets ?? [];
        expect(sheets[sheets.length - 1]).toBe(controlSheet);
    });
});
