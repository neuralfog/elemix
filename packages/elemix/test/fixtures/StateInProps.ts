import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { state } from '../../src/State';

export type StateInPropsChildProps = {
    state: {
        nestedValue: string;
    };
};

export class StateInPropsChild extends Component<StateInPropsChildProps> {
    template = (): Template => {
        return html` <h1>StateInPropsChild</h1>`;
    };
}

defineComponent('state-in-props-child', StateInPropsChild);

export class StateInProps extends Component {
    state = state({
        nested: {
            nestedValue: 'Nested Initial Value',
        },
    });

    template = (): Template => {
        return html`
            <h1>StateInProps</h1>
            <p>${this.state.nested.nestedValue}</p>
            <state-in-props-child :state=${this.state.nested} />
        `;
    };
}

defineComponent('state-in-props', StateInProps);
