import { Component } from '../../src/component/Component';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { html, type Template } from '../../src/types';

export const counter = { value: 0 };

export const resetCounter = (): void => {
    counter.value = 0;
};

@component()
export class BeforeMountChild extends Component {
    beforeMount(): void {
        counter.value++;
    }
    template = (): Template => html`<span class="child">child</span>`;
}

@component()
export class BeforeMountParent extends Component {
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
