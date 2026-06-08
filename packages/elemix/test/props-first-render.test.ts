import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';

import './fixtures/PropsFirstRender';
import type {
    PropsFirstRenderChild,
    PropsFirstRenderParent,
} from './fixtures/PropsFirstRender';

describe('Props available during first render', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('child beforeMount sees the bound :model prop', async () => {
        const presenter = present().screen(
            html`<props-first-render-parent></props-first-render-parent>`,
        );
        await render();
        const child = presenter.getComponent<PropsFirstRenderChild>(
            'props-first-render-child',
        );
        expect(child.beforeMountSawModel).toBe(true);
    });

    test('child template sees the bound :model prop on first render', async () => {
        const presenter = present().screen(
            html`<props-first-render-parent></props-first-render-parent>`,
        );
        await render();
        const child = presenter.getComponent<PropsFirstRenderChild>(
            'props-first-render-child',
        );
        expect(child.templateSawModel).toBe(true);
    });

    test('child shadow DOM renders the prop value, not undefined', async () => {
        const presenter = present().screen(
            html`<props-first-render-parent></props-first-render-parent>`,
        );
        await render();
        const child = presenter.getComponent<PropsFirstRenderChild>(
            'props-first-render-child',
        );
        const zoomEl = child.root?.querySelector('.zoom');
        expect(zoomEl?.textContent).toBe('1');
    });

    test('parent reused — child is created via update path, props still bind in time', async () => {
        const presenter = present().screen(
            html`<props-first-render-parent></props-first-render-parent>`,
        );
        await render();
        const parent = presenter.root<PropsFirstRenderParent>();
        // Mutate state to trigger a re-render of the parent — the child
        // node persists, but its props are re-applied via the update path.
        parent.state.canvas.value.zoom = 2;
        await render();
        const child = presenter.getComponent<PropsFirstRenderChild>(
            'props-first-render-child',
        );
        const zoomEl = child.root?.querySelector('.zoom');
        expect(zoomEl?.textContent).toBe('2');
    });
});
