import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { store } from './Signal';

type TestCompProps = {
    color: string;
    size: number;
    handler: () => void;
};

@component({ tag: 'test-comp', signals: [store] })
export class TestComp extends Component<TestCompProps> {
    @state()
    state = {
        string: 'Initial State Value',
    };

    @state()
    state2 = {
        number: 0,
    };

    onRender = (_renderTrigger?: string[]): void => {};

    onDispose = (): void => {};

    template = (): Template => {
        return html`<div>
            <h1>TestComp</h1>
            <p id="test-comp-state">${this.state.string}</p>
            <p id="test-comp-state-2">${this.state2.number}</p>
            <p id="test-comp-signal">${store.value.value}</p>
            <p id="test-comp-props">${this.props.color} - ${this.props.size}</p>
        </div>`;
    };
}
