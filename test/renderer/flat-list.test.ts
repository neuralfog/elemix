import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';
import { render } from '../../utilities';
import type { RendererList } from '../fixtures/renderer/RendererList';
import { HTML } from '../../testing/snapshots';

import '../fixtures/renderer/RendererList';

describe('Renderer Flat List', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('render', async () => {
        // Initial State
        const presenter = present().screen(
            html`<renderer-list></renderer-list>`,
        );
        const component = presenter.getComponent<RendererList>('renderer-list');
        await render();
        expect(HTML(presenter.root<RendererList>())).toMatchSnapshot();

        // Move elements and add new
        component.state.list = [
            'Sophia Brown',
            'Olivia Davis',
            'John Doe',
            'Benjamin Williams',
            'Emily Johnson',
            'Michael Smith',
        ];
        await render();
        expect(HTML(presenter.root<RendererList>())).toMatchSnapshot();

        // Remove Elements
        component.state.list = ['Michael Smith', 'Benjamin Williams'];
        await render();
        expect(HTML(presenter.root<RendererList>())).toMatchSnapshot();

        // Empty List
        component.state.list = [];
        await render();
        expect(HTML(presenter.root<RendererList>())).toMatchSnapshot();
    });
});
