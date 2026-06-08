import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { state } from '../../src/State';

import './TestComp';

export class MainApp extends Component {
    state = state({
        string: 'Initial State Value',
        color: 'Initial Color',
        size: 0,
    });

    propsHandler = (): void => {};

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

defineComponent('main-app', MainApp);
