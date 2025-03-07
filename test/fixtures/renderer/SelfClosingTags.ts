import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';

import './SelfClosed';
import { state } from '../../../decorators';

export enum State {
    SINGLE = 0,
    START = 1,
    END = 2,
    MIDDLE = 3,
}

@component()
export class SelfClosingTags extends Component {
    @state()
    state = {
        case: State.SINGLE,
    };

    partial = (): Template => {
        if (this.state.case === State.SINGLE) {
            return html`<self-closed />`;
        }

        if (this.state.case === State.START) {
            return html`
                <self-closed />
                <p>Hello There</p>
            `;
        }

        if (this.state.case === State.END) {
            return html`
                <p>hello there</p>
                <self-closed />
            `;
        }

        if (this.state.case === State.MIDDLE) {
            return html`
                <p>hello there</p>
                <self-closed />
                <p>hello there</p>
            `;
        }

        return html``;
    };

    template = (): Template => {
        return this.partial();
    };
}
