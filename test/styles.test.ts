import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { StyledApp } from './fixtures/StyledApp';
import { initApp } from '../app';
import type { ListApp } from './fixtures/ListApp';

import './fixtures/StyledApp';
import './fixtures/ListApp';

describe('Styles', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Unstyled Component', async () => {
        const presenter = new Present().screen(html`<list-app />`);
        const listApp = presenter.root<ListApp>();
        expect(listApp.styles.sheet).toBe(undefined);
    });

    test('Component With Styles', async () => {
        const presenter = new Present().screen(html`<styled-app />`);
        const styledApp = presenter.root<StyledApp>();
        expect(styledApp.styles.sheet?.cssRules.length).toBe(1);
    });

    test('Component With Reset And Styles', async () => {
        initApp({
            cssReset: `.reset { color: 'grey'; }`,
        });

        const presenter = new Present().screen(html`<styled-app />`);
        const styledApp = presenter.root<StyledApp>();

        expect(styledApp.styles.sheet?.cssRules.length).toBe(2);
        expect(styledApp.styles.styles).toMatchObject([
            ".reset { color: 'grey'; }",
            ".styles { color: 'green'; }",
        ]);
    });
});
