import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    first: string;
    last: string;
    middle: string | null;
    n: number;
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
    code { font-family: ui-monospace, monospace; font-size: 12px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px; }
    p { margin: 0 0 8px; font-size: 15px; }
    .k { color: #94a3b8; }
    button { font: inherit; font-size: 13px; padding: 6px 12px; margin: 12px 8px 0 0; border: none; border-radius: 8px; background: #e2e8f0; cursor: pointer; }
    button:hover { background: #cbd5e1; }
`;

export class InterpApp extends Component {
    static styles = [css];

    state = state<State>({
        first: 'Ada',
        last: 'Lovelace',
        middle: null,
        n: 0,
    });

    swap = (): void => {
        const f = this.state.first;
        this.state.first = this.state.last;
        this.state.last = f;
    };

    clearMiddle = (): void => {
        this.state.middle = this.state.middle ? null : 'M';
    };

    inc = (): void => {
        this.state.n++;
    };

    template = (): Template => tpl`
        <p class="note">
            Interpolation edge cases: adjacent holes with no static text between,
            holes separated by static text, a <code>null</code> value (renders
            empty), and a numeric hole.
        </p>
        <p class="full"><span class="k">full:</span> ${this.state.first}${this.state.last}</p>
        <p class="dash"><span class="k">dash:</span> ${this.state.first}-${this.state.last}</p>
        <p class="middle"><span class="k">middle:</span> [${this.state.middle}]</p>
        <p class="num"><span class="k">num:</span> ${this.state.n}</p>
        <button @click=${this.swap}>swap</button>
        <button @click=${this.clearMiddle}>set middle</button>
        <button @click=${this.inc}>inc</button>
    `;
}

defineComponent('interp-app', InterpApp);
