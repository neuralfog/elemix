import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import { when, choose } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

type State = {
    status: Status;
    showLog: boolean;
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
    .bar { display: flex; gap: 8px; margin-bottom: 16px; }
    button {
        font: inherit;
        font-size: 13px;
        padding: 7px 12px;
        color: #1e293b;
        background: #e2e8f0;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    button:hover { background: #cbd5e1; }
    .stage { margin-bottom: 14px; }
    .card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 20px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 12px;
    }
    .card.idle { color: #64748b; background: #f1f5f9; border: 1px dashed #cbd5e1; }
    .card.loading { color: #3730a3; background: #e0e7ff; }
    .card.ready { color: #166534; background: #dcfce7; }
    .card.failed { color: #991b1b; background: #fee2e2; }
    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #c7d2fe;
        border-top-color: #4338ca;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .link { background: none; padding: 4px 0; color: var(--accent); font-size: 13px; }
    .link:hover { background: none; text-decoration: underline; }
    .log {
        margin: 10px 0 0;
        padding: 12px 14px;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        color: #e2e8f0;
        background: #0f172a;
        border-radius: 8px;
    }
`;

export class StatusApp extends Component {
    static styles = [css];

    state = state<State>({
        status: 'idle',
        showLog: false,
    });

    set = (status: Status): void => {
        this.state.status = status;
    };

    toggleLog = (): void => {
        this.state.showLog = !this.state.showLog;
    };

    template = (): Template => tpl`
        <p class="note">
            <code>choose</code> renders the first branch whose condition is
            truthy — use <code>[true, ...]</code> as the fallback.
            <code>when</code> renders one branch or nothing. Both take lazy
            factory functions, so only the chosen branch is ever built.
        </p>
        <div class="bar">
            <button @click=${() => this.set('idle')}>Idle</button>
            <button @click=${() => this.set('loading')}>Loading</button>
            <button @click=${() => this.set('ready')}>Ready</button>
            <button @click=${() => this.set('failed')}>Failed</button>
        </div>
        <div class="stage">
            ${choose([
                [this.state.status === 'loading', () => tpl`<div class="card loading"><span class="spinner"></span>Working…</div>`],
                [this.state.status === 'ready', () => tpl`<div class="card ready">✓ Deployed</div>`],
                [this.state.status === 'failed', () => tpl`<div class="card failed">✕ Build failed</div>`],
                [true, () => tpl`<div class="card idle">Pick a status above</div>`],
            ])}
        </div>
        <button class="link" @click=${this.toggleLog}>
            ${this.state.showLog ? 'Hide' : 'Show'} log
        </button>
        ${when(
            this.state.showLog,
            () => tpl`<pre class="log">status = ${this.state.status}</pre>`,
        )}
    `;
}

defineComponent('status-app', StatusApp);
