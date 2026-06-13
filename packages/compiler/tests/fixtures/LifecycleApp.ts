import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './LifecycleChild';
import './LogView';
import { clearLog } from './LifecycleStore';

type State = { mounted: boolean; tick: number };

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 460px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .note {
        margin: 0 0 20px;
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
    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 56px;
        margin-bottom: 14px;
        padding: 12px;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
    }
    .stage .empty { font-size: 13px; color: #94a3b8; }
    .buttons { display: flex; gap: 10px; margin-bottom: 16px; }
    button {
        font: inherit;
        padding: 9px 14px;
        border: none;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    button:hover:not(:disabled) { background: #4f46e5; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.ghost { background: #e2e8f0; color: #475569; }
    button.ghost:hover { background: #cbd5e1; }
`;

export class LifecycleApp extends Component {
    static styles = [css];

    state = state<State>({ mounted: false, tick: 0 });

    toggleMount = (): void => {
        this.state.mounted = !this.state.mounted;
    };

    update = (): void => {
        this.state.tick++;
    };

    clear = (): void => {
        clearLog();
    };

    template = (): Template => tpl`
        <p class="note">
            Mounting and unmounting the child fires <code>beforeMount</code>,
            <code>onMount</code> and <code>onDispose</code>. Updating it
            re-renders and fires <code>onMutation</code>. Each hook appends to
            the log below.
        </p>
        <div class="stage">
            ${
                this.state.mounted
                    ? tpl`<lifecycle-child :tick=${this.state.tick} />`
                    : tpl`<div class="empty">child unmounted</div>`
            }
        </div>
        <div class="buttons">
            <button @click=${this.toggleMount}>
                ${this.state.mounted ? 'Unmount' : 'Mount'}
            </button>
            <button @click=${this.update} disabled=${!this.state.mounted}>
                Update child
            </button>
            <button class="ghost" @click=${this.clear}>Clear log</button>
        </div>
        <log-view />
    `;
}

defineComponent('lifecycle-app', LifecycleApp);
