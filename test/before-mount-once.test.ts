import { expect, test, describe, beforeEach } from 'vitest';
import { Component } from '../src/component/Component';
import { component } from '../src/decorators/component';
import { state } from '../src/decorators/state';
import { html, type Template } from '../src/types';
import { present } from '../testing';
import { render } from '../utilities';

let mountCounter = 0;

@component()
export class BeforeMountChild extends Component {
    beforeMount(): void {
        mountCounter++;
    }
    template = (): Template => html`<span class="child">child</span>`;
}

@component()
class BeforeMountParent extends Component {
    @state()
    state = { count: 0 };

    template = (): Template =>
        html`<before-mount-child></before-mount-child>
            <span class="counter">${this.state.count}</span>`;
}

@component()
export class BeforeMountSwapParent extends Component {
    @state()
    state = { showB: false };

    template = (): Template =>
        this.state.showB
            ? html`<div class="b">
                  <before-mount-child></before-mount-child>
              </div>`
            : html`<div class="a">loading…</div>`;
}

describe('beforeMount fires exactly once per element', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mountCounter = 0;
    });

    test('single mount fires beforeMount once', async () => {
        present().screen(html`<before-mount-parent></before-mount-parent>`);
        await render();
        expect(mountCounter).toBe(1);
    });

    test('parent re-renders do not re-fire child beforeMount', async () => {
        const presenter = present().screen(
            html`<before-mount-parent></before-mount-parent>`,
        );
        await render();
        expect(mountCounter).toBe(1);
        const parent = presenter.root<BeforeMountParent>();
        parent.state.count = 1;
        await render();
        parent.state.count = 2;
        await render();
        expect(mountCounter).toBe(1);
    });

    test('conditional template swap (loading → layout) fires child beforeMount once', async () => {
        const presenter = present().screen(
            html`<before-mount-swap-parent></before-mount-swap-parent>`,
        );
        await render();
        expect(mountCounter).toBe(0);
        const parent = presenter.root<BeforeMountSwapParent>();
        parent.state.showB = true;
        await render();
        expect(mountCounter).toBe(1);
    });
});
