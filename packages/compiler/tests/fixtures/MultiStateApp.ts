import { Component, defineComponent, state } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type CounterState = { count: number };
type UserState = { name: string; online: boolean };

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
    .slice {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding: 14px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    .count { font-size: 28px; font-weight: 800; color: var(--accent); min-width: 40px; }
    .name { font-size: 16px; }
    .status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #dcfce7;
        color: #166534;
    }
    button {
        font: inherit;
        font-size: 13px;
        padding: 6px 12px;
        border: none;
        border-radius: 8px;
        background: #e2e8f0;
        color: #1e293b;
        cursor: pointer;
    }
    button:hover { background: #cbd5e1; }
`;

export class MultiStateApp extends Component {
    static styles = [css];

    counter = state<CounterState>({ count: 0 });
    user = state<UserState>({ name: 'Ada', online: true });

    inc = (): void => {
        this.counter.count++;
    };

    reset = (): void => {
        this.counter.count = 0;
    };

    toggle = (): void => {
        this.user.online = !this.user.online;
    };

    rename = (): void => {
        this.user.name = this.user.name === 'Ada' ? 'Grace' : 'Ada';
    };

    template = (): Template => tpl`
        <p class="note">
            A component can hold several independent <code>state()</code> slices.
            Each is deeply reactive on its own — mutating <code>counter</code>
            re-renders only the count, never the user card, and vice versa.
        </p>
        <div class="slice">
            <span class="count">${this.counter.count}</span>
            <button @click=${this.inc}>+1</button>
            <button @click=${this.reset}>reset</button>
        </div>
        <div class="slice">
            <strong class="name">${this.user.name}</strong>
            <span class="status">${this.user.online ? 'online' : 'offline'}</span>
            <button @click=${this.toggle}>toggle status</button>
            <button @click=${this.rename}>rename</button>
        </div>
    `;
}

defineComponent('multi-state-app', MultiStateApp);
