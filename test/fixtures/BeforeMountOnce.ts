import { Component, defineComponent } from '../../src/component/Component';
import { state } from '../../src/State';
import { html, type Template } from '../../src/types';

export const counter = { value: 0 };

export const resetCounter = (): void => {
    counter.value = 0;
};

export class BeforeMountChild extends Component {
    beforeMount(): void {
        counter.value++;
    }
    template = (): Template => html`<span class="child">child</span>`;
}

defineComponent('before-mount-child', BeforeMountChild);

export class BeforeMountParent extends Component {
    state = state({ count: 0 });

    template = (): Template =>
        html`<before-mount-child></before-mount-child>
            <span class="counter">${this.state.count}</span>`;
}

defineComponent('before-mount-parent', BeforeMountParent);

export class BeforeMountSwapParent extends Component {
    state = state({ showB: false });

    template = (): Template =>
        this.state.showB
            ? html`<div class="b">
                  <before-mount-child></before-mount-child>
              </div>`
            : html`<div class="a">loading…</div>`;
}

defineComponent('before-mount-swap-parent', BeforeMountSwapParent);
