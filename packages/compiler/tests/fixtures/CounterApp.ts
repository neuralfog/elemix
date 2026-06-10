import { Component, defineComponent, state } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    count: number;
};

const css = `
    :host {
        --accent: #6366f1;
        --accent-hover: #4f46e5;
        display: block;
        margin-bottom: 24px;
        font-family: system-ui, sans-serif;
    }
    button {
        font: inherit;
        padding: 8px 18px;
        border-radius: 10px;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: white;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    button:hover {
        background: var(--accent-hover);
    }
`;

export class CounterApp extends Component {
    static styles = [css];

    state = state<State>({ count: 0 });

    increment = (): void => {
        this.state.count++;
    };

    template = (): Template =>
        tpl`<button @click=${this.increment}>count is ${this.state.count}</button>`;
}

defineComponent('counter-app', CounterApp);
