import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    title: string;
    count: number;
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 440px;
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
    .panel {
        padding: 18px 20px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    h2 { margin: 0 0 6px; font-size: 20px; }
    .stat { margin: 0 0 14px; font-size: 14px; color: #475569; }
    button {
        font: inherit;
        font-size: 13px;
        padding: 6px 12px;
        margin-right: 8px;
        border: none;
        border-radius: 8px;
        background: #e2e8f0;
        color: #1e293b;
        cursor: pointer;
    }
    button:hover { background: #cbd5e1; }
`;

export class PanelApp extends Component {
    static styles = [css];

    state = state<State>({
        title: 'Inbox',
        count: 3,
    });

    add = (): void => {
        this.state.count++;
    };

    rename = (): void => {
        this.state.title = this.state.title === 'Inbox' ? 'Archive' : 'Inbox';
    };

    headerTemplate = (): Template => tpl`<h2>${this.state.title}</h2>`;

    statTemplate = (): Template =>
        tpl`<p class="stat">${this.state.count} open</p>`;

    template = (): Template => tpl`
        <p class="note">
            Sub-templates pulled out as <code>class members</code> — the natural
            way to organize a component. The main template composes them with
            member calls; each stays independently reactive.
        </p>
        <div class="panel">
            ${this.headerTemplate()}
            ${this.statTemplate()}
            <button @click=${this.add}>add</button>
            <button @click=${this.rename}>rename</button>
        </div>
    `;
}

defineComponent('panel-app', PanelApp);
