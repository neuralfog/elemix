import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// Proof that a BARE primitive is reactive state — no object wrapper, no
// `.value` box. `// #state count = 0` makes `this.count` itself reactive: the
// compiler lowers each primitive field to a get/set accessor over a private
// backing field + a per-instance `dep()`. Number, boolean and string each get
// their own slice and re-render only their own binding.

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 420px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding: 14px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    .count { font-size: 26px; font-weight: 800; color: var(--accent); min-width: 40px; }
    .active {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #dcfce7;
        color: #166534;
    }
    .label { font-size: 16px; font-weight: 600; }
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

// #component
export class PrimitiveStateApp extends Component {
    // #styles
    styles = css;

    // #state
    count = 0;

    // #state
    active: boolean = true;

    // #state
    label = 'idle';

    increment = (): void => {
        this.count++;
    };

    reset = (): void => {
        this.count = 0;
    };

    toggle = (): void => {
        this.active = !this.active;
    };

    rename = (): void => {
        this.label = this.label === 'idle' ? 'busy' : 'idle';
    };

    template = (): Template => tpl`
        <div class="row">
            <span class="count">${this.count}</span>
            <button @click=${this.increment}>+1</button>
            <button @click=${this.reset}>reset</button>
        </div>
        <div class="row">
            <span class="active">${this.active ? 'on' : 'off'}</span>
            <button @click=${this.toggle}>toggle</button>
        </div>
        <div class="row">
            <strong class="label">${this.label}</strong>
            <button @click=${this.rename}>rename</button>
        </div>
    `;
}
