import { Component, ref, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    width: number;
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
    input {
        box-sizing: border-box;
        width: 100%;
        margin-bottom: 12px;
        font: inherit;
        font-size: 15px;
        padding: 9px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        outline: none;
    }
    input:focus { border-color: var(--accent); }
    .buttons { display: flex; gap: 10px; margin-bottom: 14px; }
    button {
        font: inherit;
        padding: 9px 16px;
        border: none;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    button.ghost { background: #e2e8f0; color: #475569; }
    button.ghost:hover { background: #cbd5e1; }
    .out { font-size: 14px; font-weight: 600; color: var(--accent); }
`;

`#component #styles ${css}`
export class RefApp extends Component {

    input = ref<HTMLInputElement>();

    state = state<State>({ width: 0 });

    focusInput = (): void => {
        this.input.value?.focus();
    };

    measure = (): void => {
        this.state.width = this.input.value?.offsetWidth ?? 0;
    };

    template = (): Template => tpl`
        <p class="note">
            <code>:ref</code> binds a DOM node to a <code>ref()</code>. Read the
            element imperatively through <code>this.input.value</code> — here to
            focus the field and measure its width.
        </p>
        <input type="text" :ref=${this.input} placeholder="Type something…" />
        <div class="buttons">
            <button @click=${this.focusInput}>Focus</button>
            <button class="ghost" @click=${this.measure}>Measure width</button>
        </div>
        ${
            this.state.width
                ? tpl`<div class="out">Input is ${this.state.width}px wide</div>`
                : ''
        }
    `;
}

