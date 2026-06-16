import { Component, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { count: number };

const css = `
    :host {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 6px;
        font-family: system-ui, sans-serif;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    button {
        font: inherit;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    .count { font-weight: 700; min-width: 2ch; text-align: center; color: #1e293b; }
`;

// Proof: a block-bodied template that destructures before its return. The
// compiler must keep the statements that come before the return (here the
// `const { inc, dec } = this`) when it lowers the body into view() — otherwise
// inc/dec would be undefined. Reactivity is unaffected: count is still read as
// this.state.count inside the effect.
`#component #styles ${css}`
export class ProofDestructuring extends Component {
    state = state<State>({ count: 0 });

    inc = (): void => {
        this.state.count++;
    };

    dec = (): void => {
        this.state.count--;
    };

    template = (): Template => {
        const { inc, dec } = this;
        return tpl`<div>
            <button class="dec" @click=${dec}>−</button>
            <span class="count">${this.state.count}</span>
            <button class="inc" @click=${inc}>+</button>
        </div>`;
    };
}
