import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { present } from '../../testing';
import { render } from '../../utilities';
import { HTML } from '../../testing/snapshots';

import '../fixtures/renderer/MultilpleRootNodes';

describe('Renderer Multiple Root Nodes', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('render', async () => {
        const presenter = present().screen(
            html`<multiple-root-nodes></multiple-root-nodes>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
