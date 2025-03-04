import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';

import './TestComp';

@component({ tag: 'main-app' })
export class MainApp extends Component {
    @state()
    state = {
        string: 'Initial State Value',
        color: 'Initial Color',
        size: 0,
    };

    propsHandler = (): void => {};

    onRender = (_renderTrigger?: string[]): void => {};

    template = (): Template => {
        return html`
            <h1>MainApp</h1>
            <p id="main-app-state">${this.state.string}</p>
            <test-comp
                :color=${this.state.color}
                :size=${this.state.size}
                :handler=${this.propsHandler}
            />
        `;
    };
}
