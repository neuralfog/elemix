import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';

export type StateInPropsChildProps = {
    state: {
        nestedValue: string;
    };
};

@component()
export class StateInPropsChild extends Component<StateInPropsChildProps> {
    onRender = (_renderTrigger?: string[]): void => {};

    template = (): Template => {
        return html` <h1>StateInPropsChild</h1>`;
    };
}

@component()
export class StateInProps extends Component {
    @state()
    state = {
        nested: {
            nestedValue: 'Nested Initial Value',
        },
    };

    onRender = (_renderTrigger?: string[]): void => {};

    template = (): Template => {
        return html`
            <h1>StateInProps</h1>
            <p>${this.state.nested.nestedValue}</p>
            <state-in-props-child :state=${this.state.nested} />
        `;
    };
}
