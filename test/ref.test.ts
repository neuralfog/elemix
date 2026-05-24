import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { present } from '@neuralfog/elemix-testing';
import { render } from '../utilities';
import type { RefApp } from './fixtures/Ref';

import './fixtures/Ref';

describe('Ref', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('ref', async () => {
        const presenter = present().screen(html`<ref-app></ref-app>`);
        const refApp = presenter.root<RefApp>();

        await render();

        expect(refApp.ref.value instanceof HTMLDivElement).toBe(true);
    });
});
