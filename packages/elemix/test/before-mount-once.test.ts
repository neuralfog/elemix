import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/types';
import { present } from '../testing';
import { render } from '../utilities';
import {
    counter,
    resetCounter,
    type BeforeMountParent,
    type BeforeMountSwapParent,
} from './fixtures/BeforeMountOnce';
import './fixtures/BeforeMountOnce';

describe('beforeMount fires exactly once per element', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetCounter();
    });

    test('single mount fires beforeMount once', async () => {
        present().screen(html`<before-mount-parent></before-mount-parent>`);
        await render();
        expect(counter.value).toBe(1);
    });

    test('parent re-renders do not re-fire child beforeMount', async () => {
        const presenter = present().screen(
            html`<before-mount-parent></before-mount-parent>`,
        );
        await render();
        expect(counter.value).toBe(1);
        const parent = presenter.root<BeforeMountParent>();
        parent.state.count = 1;
        await render();
        parent.state.count = 2;
        await render();
        expect(counter.value).toBe(1);
    });

    test('conditional template swap (loading → layout) fires child beforeMount once', async () => {
        const presenter = present().screen(
            html`<before-mount-swap-parent></before-mount-swap-parent>`,
        );
        await render();
        expect(counter.value).toBe(0);
        const parent = presenter.root<BeforeMountSwapParent>();
        parent.state.showB = true;
        await render();
        expect(counter.value).toBe(1);
    });
});
