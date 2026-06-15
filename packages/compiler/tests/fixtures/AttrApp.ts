import { Component, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    userId: number;
    label: string;
    collapsed: boolean;
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
    .link { color: var(--accent); display: inline-block; margin-bottom: 10px; }
    .badge {
        display: inline-block;
        padding: 2px 10px;
        margin-bottom: 12px;
        font-size: 13px;
        background: #e2e8f0;
        border-radius: 999px;
    }
    .secret {
        margin-bottom: 14px;
        padding: 10px 12px;
        background: #fef3c7;
        border-radius: 8px;
        font-size: 13px;
    }
    button {
        font: inherit;
        font-size: 13px;
        padding: 6px 12px;
        margin-right: 8px;
        border: none;
        border-radius: 8px;
        background: #e2e8f0;
        cursor: pointer;
    }
    button:hover { background: #cbd5e1; }
`;

`#component #styles ${css}`
export class AttrApp extends Component {

    state = state<State>({
        userId: 1,
        label: 'Ada',
        collapsed: false,
    });

    next = (): void => {
        this.state.userId++;
    };

    rename = (): void => {
        this.state.label = this.state.label === 'Ada' ? 'Grace' : 'Ada';
    };

    toggle = (): void => {
        this.state.collapsed = !this.state.collapsed;
    };

    template = (): Template => tpl`
        <p class="note">
            Everything in a template is an attribute. <code>_attr</code> handles
            interpolated values (<code>href</code>), <code>data-*</code>/<code>aria-*</code>,
            and boolean attributes that toggle their presence (<code>hidden</code>).
        </p>
        <a class="link" href="/users/${this.state.userId}" title=${this.state.label}>
            Open profile #${this.state.userId}
        </a>
        <span class="badge" data-count=${this.state.userId} aria-label=${this.state.label}>
            ${this.state.label}
        </span>
        <div class="secret" hidden=${this.state.collapsed}>Secret content</div>
        <button @click=${this.next}>next user</button>
        <button @click=${this.rename}>rename</button>
        <button @click=${this.toggle}>toggle secret</button>
    `;
}

