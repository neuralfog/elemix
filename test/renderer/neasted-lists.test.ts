import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '@neuralfog/elemix-testing';
import { render } from '../../utilities';
import { HTML } from '@neuralfog/elemix-testing/snapshots';

import '../fixtures/renderer/RendererNestedList';
import '../fixtures/renderer/RendererTripleNestedList';

describe('Renderer Nested Lists', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('render one level', async () => {
        const presenter = present().screen(
            html`<renderer-nested-list></renderer-nested-list>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('render two levels', async () => {
        const presenter = present().screen(
            html`<renderer-tripple-nested-list></renderer-tripple-nested-list>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
