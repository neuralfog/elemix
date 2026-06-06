import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { ref } from '../../src/utilities';
import { state } from '../../src/decorators/state';

const clamp = (v: string): string => {
    const n = Number(v);
    return String(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
};

@component()
export class OnModelClampApp extends Component {
    @state()
    state = {
        input: ref(''),
    };

    template = (): Template => {
        return html`
            <p>${this.state.input.value}</p>
            <input
                type="text"
                ~model=${this.state.input}
                ~onmodel=${clamp}
            />
        `;
    };
}

@component()
export class OnModelOnlyApp extends Component {
    public calls: string[] = [];

    template = (): Template => {
        return html`<input
            type="text"
            ~onmodel=${(v: string): string => {
                this.calls.push(v);
                return v;
            }}
        />`;
    };
}

@component()
export class OnModelOrderApp extends Component {
    @state()
    state = {
        input: ref(''),
    };

    template = (): Template => {
        return html`<input
            type="text"
            ~onmodel=${clamp}
            ~model=${this.state.input}
        />`;
    };
}
