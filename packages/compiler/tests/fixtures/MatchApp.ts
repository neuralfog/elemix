import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Load =
    | { kind: 'idle' }
    | { kind: 'loading'; pct: number }
    | { kind: 'ready'; url: string }
    | { kind: 'failed'; error: string };

type Mode = 'compact' | 'full';

type State = {
    load: Load;
    mode: Mode;
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 460px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
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
    }
    .mode { font-size: 12px; color: var(--accent); }
`;

// #component
export class MatchApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        load: { kind: 'idle' },
        mode: 'compact',
    };

    idle = (): void => {
        this.state.load = { kind: 'idle' };
    };

    loading = (): void => {
        this.state.load = { kind: 'loading', pct: 42 };
    };

    ready = (): void => {
        this.state.load = { kind: 'ready', url: '/build/app.js' };
    };

    failed = (): void => {
        this.state.load = { kind: 'failed', error: 'boom' };
    };

    toggleMode = (): void => {
        this.state.mode = this.state.mode === 'compact' ? 'full' : 'compact';
    };

    template = (): Template => tpl`
        <div class="bar">
            <button @click=${this.idle}>Idle</button>
            <button @click=${this.loading}>Loading</button>
            <button @click=${this.ready}>Ready</button>
            <button @click=${this.failed}>Failed</button>
        </div>
        <div class="stage">
            ${match(this.state.load, 'kind', {
                idle: () => tpl`<div class="card idle">Pick a state above</div>`,
                loading: (m) => tpl`<div class="card loading"><span class="spinner"></span>Working ${m.pct}%</div>`,
                ready: (m) => tpl`<div class="card ready">✓ Deployed to ${m.url}</div>`,
                failed: (m) => tpl`<div class="card failed">✕ ${m.error}</div>`,
            })}
        </div>
        <button class="link" @click=${this.toggleMode}>toggle mode</button>
        ${match(this.state.mode, {
            compact: () => tpl`<span class="mode">compact</span>`,
            full: () => tpl`<span class="mode">full view</span>`,
        })}
    `;
}
