import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';

import type { RefApp } from './fixtures/Ref';

import './fixtures/Ref';

describe('Ref', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('ref', async () => {
        const presenter = new Present().screen(html`<ref-app />`);
        const refApp = presenter.root<RefApp>();

        await presenter.wait();

        expect(refApp.ref.value instanceof HTMLDivElement).toBe(true);
    });
});
