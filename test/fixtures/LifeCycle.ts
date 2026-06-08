import { Component, defineComponent } from '../../src/component/Component';
import type { Template } from '../../src/types';
import { html } from '../../src/types';

export class LifeCycle extends Component {
    beforeMount = (): void => {};
    onMount = (): void => {};
    onDispose = (): void => {};

    template = (): Template => {
        return html`<h1>Ola !</h1>`;
    };
}

defineComponent('life-cycle', LifeCycle);
