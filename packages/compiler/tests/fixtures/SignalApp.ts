import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SignalValue';
import './SignalButtons';

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 440px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
        text-align: center;
    }
    .note {
        margin: 0 0 20px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        text-align: left;
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
`;

export class SignalApp extends Component {
    static styles = [css];

    template = (): Template => tpl`
        <p class="note">
            A reactive <code>state</code> store created in its own module
            (<code>SignalStore.ts</code>) and imported wherever it is needed. The
            two components below are siblings with no props between them — yet the
            buttons in one update the number shown in the other, because both
            subscribe to the same store.
        </p>
        <signal-value />
        <signal-buttons />
    `;
}

defineComponent('signal-app', SignalApp);
