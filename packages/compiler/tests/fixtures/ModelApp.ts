import { Component, defineComponent, ref, state } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

const clamp = (v: string): string => {
    const n = Number(v);
    return String(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
};

type State = {
    name: Ref<string>;
    volume: Ref<string>;
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 420px;
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
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #475569;
    }
    input {
        font: inherit;
        font-size: 15px;
        padding: 9px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        outline: none;
    }
    input:focus { border-color: var(--accent); }
    .out {
        margin-bottom: 20px;
        font-size: 15px;
        font-weight: 600;
        color: var(--accent);
    }
    .out:last-child { margin-bottom: 0; }
`;

export class ModelApp extends Component {
    static styles = [css];

    state = state<State>({
        name: ref('Ada'),
        volume: ref('50'),
    });

    template = (): Template => tpl`
        <p class="note">
            <code>~model</code> two-way binds an input to a ref.
            <code>~onmodel</code> runs a transform on every keystroke before the
            value is stored — here it clamps the number to 0–100.
        </p>
        <label>
            Name (<code>~model</code>)
            <input type="text" ~model=${this.state.name} />
        </label>
        <div class="out">Hello, ${this.state.name.value || '…'}</div>
        <label>
            Volume (<code>~model</code> + <code>~onmodel</code>, clamped 0–100)
            <input type="text" ~model=${this.state.volume} ~onmodel=${clamp} />
        </label>
        <div class="out">Volume: ${this.state.volume.value}</div>
    `;
}

defineComponent('model-app', ModelApp);
