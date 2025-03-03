import { Component } from '../../src/component/Component';
import { component } from '../../src/decorators/component';
import type { Template } from '../../src/types';
import { html } from '../../src/types';

@component({ tag: 'life-cycle' })
export class LifeCycle extends Component {
    beforeMount = (): void => {};
    onRender = (_renderTrigger?: string[]): void => {};
    onMount = (): void => {};
    onDispose = (): void => {};

    template = (): Template => {
        return html`<h1>Ola !</h1>`;
    };
}
