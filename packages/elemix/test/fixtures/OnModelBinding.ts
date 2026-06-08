import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { ref } from '../../src/utilities';
import { state } from '../../src/State';

const clamp = (v: string): string => {
    const n = Number(v);
    return String(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
};

export class OnModelClampApp extends Component {
    state = state({
        input: ref(''),
    });

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

defineComponent('on-model-clamp-app', OnModelClampApp);

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

defineComponent('on-model-only-app', OnModelOnlyApp);

export class OnModelOrderApp extends Component {
    state = state({
        input: ref(''),
    });

    template = (): Template => {
        return html`<input
            type="text"
            ~onmodel=${clamp}
            ~model=${this.state.input}
        />`;
    };
}

defineComponent('on-model-order-app', OnModelOrderApp);
