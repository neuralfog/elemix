import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';
import { render } from '../../utilities';

import type { AttrBeforeConnect } from '../fixtures/renderer/AttrBeforeConnect';
import '../fixtures/renderer/AttrBeforeConnect';

describe('Attribute hole values are applied before connectedCallback', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('`beforeMount` sees the real attribute value, not the hole marker', async () => {
        const payload = JSON.stringify([{ id: 1 }, { id: 2 }]);
        const presenter = present().screen(
            html`<attr-before-connect data-payload=${payload}></attr-before-connect>`,
        );
        await render();
        const c = presenter.root<AttrBeforeConnect>();

        // No parse error means the attribute was hydrated before beforeMount ran.
        expect(c.parseError).toBeNull();
        // Raw attribute string should be the real JSON, not a marker comment.
        expect(c.rawAttr).toBe(payload);
        // And the parsed payload should be the right shape.
        expect(c.parsed).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('non-hole (literal) attribute also reaches beforeMount intact (regression guard)', async () => {
        const presenter = present().screen(
            html`<attr-before-connect data-payload='{"k":"v"}'></attr-before-connect>`,
        );
        await render();
        const c = presenter.root<AttrBeforeConnect>();
        expect(c.parseError).toBeNull();
        expect(c.rawAttr).toBe('{"k":"v"}');
        expect(c.parsed).toEqual({ k: 'v' });
    });

    test('a hole-driven attribute that is not JSON still arrives as plain text', async () => {
        const presenter = present().screen(
            html`<attr-before-connect data-payload=${'plain string'}></attr-before-connect>`,
        );
        await render();
        const c = presenter.root<AttrBeforeConnect>();
        // Plain string can't be JSON.parsed → parseError set, but rawAttr
        // proves we got the actual hydrated value, not the marker comment.
        expect(c.rawAttr).toBe('plain string');
        expect(c.parseError).not.toBeNull();
        // The error is from JSON.parse, not from anything seeing "<!--₥0-->".
        expect(c.parseError).not.toContain('₥');
    });
});
