import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';
import { render } from '../../utilities';
import { HTML } from '../../testing/snapshots';

import type { OtpLikeStructure } from '../fixtures/renderer/OtpStructure';
import '../fixtures/renderer/OtpStructure';

describe('Repeated wrapper with <input /> + sibling <div>', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('shadow root structure matches snapshot', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('every repeated item produces one wrapper, one input, one dot', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        const c = presenter.root<OtpLikeStructure>();
        const root = c.shadowRoot;
        expect(root).not.toBeNull();

        const wrappers = root?.querySelectorAll('.otp-digit-wrapper');
        const inputs = root?.querySelectorAll('input.otp-digit');
        const dots = root?.querySelectorAll('.otp-dot');

        expect(wrappers?.length).toBe(6);
        expect(inputs?.length).toBe(6);
        expect(dots?.length).toBe(6);
    });

    test('the trailing <div class="otp-dot"> is a child of its wrapper (not a sibling)', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        const c = presenter.root<OtpLikeStructure>();
        const root = c.shadowRoot;
        const wrappers = Array.from(
            root?.querySelectorAll('.otp-digit-wrapper') ?? [],
        );

        for (const wrapper of wrappers) {
            const dot = wrapper.querySelector('.otp-dot');
            expect(dot).not.toBeNull();
            expect(dot?.parentElement).toBe(wrapper);
        }
    });

    test('the input is a child of the wrapper (not a sibling)', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        const c = presenter.root<OtpLikeStructure>();
        const root = c.shadowRoot;
        const wrappers = Array.from(
            root?.querySelectorAll('.otp-digit-wrapper') ?? [],
        );

        for (const wrapper of wrappers) {
            const input = wrapper.querySelector('input.otp-digit');
            expect(input).not.toBeNull();
            expect(input?.parentElement).toBe(wrapper);
        }
    });

    test('the outer flex container holds the wrappers directly (no dot leaks)', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        const c = presenter.root<OtpLikeStructure>();
        const root = c.shadowRoot;
        const outer = root?.querySelector('.otp-digits');
        expect(outer).not.toBeNull();

        const childTags = Array.from(outer?.children ?? []).map(
            (el) => `${el.tagName.toLowerCase()}.${el.className}`,
        );
        const wrapperChildren = childTags.filter((s) =>
            s.endsWith('.otp-digit-wrapper'),
        );
        const dotChildren = childTags.filter((s) => s.endsWith('.otp-dot'));

        expect(wrapperChildren.length).toBe(6);
        expect(dotChildren.length).toBe(0);
    });

    test('each wrapper has exactly two element children (input + dot, in order)', async () => {
        const presenter = present().screen(
            html`<otp-like-structure></otp-like-structure>`,
        );
        await render();
        const c = presenter.root<OtpLikeStructure>();
        const root = c.shadowRoot;
        const wrappers = Array.from(
            root?.querySelectorAll('.otp-digit-wrapper') ?? [],
        );

        for (const wrapper of wrappers) {
            const kids = Array.from(wrapper.children);
            expect(kids.length).toBe(2);
            expect(kids[0].tagName.toLowerCase()).toBe('input');
            expect(kids[1].tagName.toLowerCase()).toBe('div');
            expect(kids[1].className).toBe('otp-dot');
        }
    });
});
