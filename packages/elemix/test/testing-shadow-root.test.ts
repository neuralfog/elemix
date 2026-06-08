import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present, query, queryAll, waitFor } from '../testing';

import './fixtures/StyledHost';

describe('queryAll', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('finds elements in the root container itself', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const results = queryAll(presenter.body(), 'styled-host');
        expect(results).toHaveLength(1);
    });

    test('walks into shadow roots when the search root is an HTMLElement with one', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const host = presenter.root<HTMLElement>();
        const results = queryAll(host, 'div.styled-host');
        expect(results).toHaveLength(1);
    });

    test('walks into shadow roots of descendants', async () => {
        const presenter = present().screen(html`
            <div>
                <styled-host></styled-host>
                <styled-host></styled-host>
            </div>
        `);
        await new Promise((r) => setTimeout(r, 0));
        const results = queryAll(presenter.body(), 'div.styled-host');
        expect(results).toHaveLength(2);
    });

    test('accepts a ShadowRoot as the search root', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const host = presenter.root<HTMLElement>();
        // biome-ignore lint/style/noNonNullAssertion: shadow root is always attached by Component
        const shadow = host.shadowRoot!;
        const results = queryAll(shadow, 'div.styled-host');
        expect(results).toHaveLength(1);
    });

    test('returns empty array when no element matches', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const results = queryAll(presenter.body(), '.does-not-exist');
        expect(results).toEqual([]);
    });
});

describe('query', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('returns the first match across shadow boundaries', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const el = query(presenter.body(), 'div.styled-host');
        expect(el).toBeDefined();
        expect(el?.textContent?.trim()).toBe('styled');
    });

    test('returns undefined when nothing matches', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const el = query(presenter.body(), '.absent');
        expect(el).toBeUndefined();
    });
});

describe('waitFor', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('resolves immediately when the element is already present', async () => {
        const presenter = present().screen(html`<styled-host></styled-host>`);
        await new Promise((r) => setTimeout(r, 0));
        const el = await waitFor(presenter.body(), 'div.styled-host');
        expect(el).toBeDefined();
    });

    test('resolves once a deferred element appears in the DOM', async () => {
        present().screen(html``);
        const promise = waitFor(document.body, '.deferred', 500);
        setTimeout(() => {
            const node = document.createElement('div');
            node.className = 'deferred';
            document.body.appendChild(node);
        }, 30);
        const el = await promise;
        expect(el.className).toBe('deferred');
    });

    test('rejects with a Timeout error when the element never shows up', async () => {
        present().screen(html``);
        await expect(waitFor(document.body, '.never', 50)).rejects.toThrow(
            'Timeout waiting for .never',
        );
    });
});
