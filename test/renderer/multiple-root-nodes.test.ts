import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import { render } from '../../utilities';
import { HTML } from '@neuralfog/elemix-testing/snapshots';

import '../fixtures/renderer/MultilpleRootNodes.ts';

describe('Renderer Multiple Root Nodes', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('render', async () => {
        const presenter = new Present().screen(html`<multiple-root-nodes />`);
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
