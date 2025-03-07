import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import { render } from '../../utilities';
import { HTML } from '@neuralfog/elemix-testing/snapshots';

import '../fixtures/renderer/RendererNestedList';
import '../fixtures/renderer/RendererTripleNestedList';

describe('Renderer Nested Lists', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('render one level', async () => {
        const presenter = new Present().screen(html`<renderer-nested-list />`);
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('render two levels', async () => {
        const presenter = new Present().screen(
            html`<renderer-tripple-nested-list />`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
