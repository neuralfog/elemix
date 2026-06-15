import { Component, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './StoreControls';

type State = {
    counter: { value: number };
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 460px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .note {
        margin: 0 0 18px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
        background: #f1f5f9;
        border-left: 3px solid var(--accent);
        border-radius: 8px;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        background: #e2e8f0;
        padding: 1px 5px;
        border-radius: 4px;
    }
    .readout { margin-bottom: 16px; font-size: 15px; }
    .readout strong { font-size: 22px; color: var(--accent); }
`;

`#component #styles ${css}`
export class StoreApp extends Component {

    state = state<State>({
        counter: { value: 0 },
    });

    template = (): Template => tpl`
        <p class="note">
            The <code>counter</code> object lives in this parent's reactive
            state and is passed down as a prop. Objects are shared by reference,
            so when the child mutates <code>this.props.counter.value</code>,
            every component subscribed to that object re-renders — including
            this parent.
        </p>
        <div class="readout">
            Parent reads: <strong>${this.state.counter.value}</strong>
        </div>
        <store-controls :counter=${this.state.counter} />
    `;
}

