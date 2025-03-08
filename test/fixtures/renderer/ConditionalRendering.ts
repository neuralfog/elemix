import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';
import { state } from '../../../decorators';

export enum State {
    SINGLE = 0,
    START = 1,
    END = 2,
    MIDDLE = 3,
}

@component()
export class ConditionalRendering extends Component {
    @state()
    state = {
        condition: true,
        case: State.SINGLE,
    };

    condition = (): Template => {
        return html`${this.state.condition ? html`<p>true</p>` : html`<p>false</p>`}`;
    };

    partial = (): Template => {
        if (this.state.case === State.SINGLE) {
            return html`${this.condition()}`;
        }

        if (this.state.case === State.START) {
            return html`
                ${this.condition()}
                <p>hello there</p>
            `;
        }

        if (this.state.case === State.END) {
            return html`
                <p>hello there</p>
                ${this.condition()}
            `;
        }

        if (this.state.case === State.MIDDLE) {
            return html`
                <p>hello there</p>
                ${this.condition()}
                <p>hello there</p>
            `;
        }

        return html``;
    };

    template = (): Template => {
        return this.partial();
    };
}
