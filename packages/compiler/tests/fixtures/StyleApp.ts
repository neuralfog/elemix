import { Component, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    color: string;
    size: number;
    bg: string;
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
    .box {
        padding: 24px;
        margin-bottom: 14px;
        border-radius: 12px;
        font-weight: 700;
        text-align: center;
        transition: all 0.15s ease;
    }
    button { font: inherit; font-size: 13px; padding: 6px 12px; margin-right: 8px; border: none; border-radius: 8px; background: #e2e8f0; cursor: pointer; }
    button:hover { background: #cbd5e1; }
`;

`#component #styles ${css}`
export class StyleApp extends Component {

    state = state<State>({
        color: '#1e293b',
        size: 18,
        bg: '#e0e7ff',
    });

    recolor = (): void => {
        this.state.color = this.state.color === '#1e293b' ? '#ffffff' : '#1e293b';
    };

    resize = (): void => {
        this.state.size = this.state.size >= 30 ? 14 : this.state.size + 4;
    };

    shade = (): void => {
        this.state.bg = this.state.bg === '#e0e7ff' ? '#6366f1' : '#e0e7ff';
    };

    template = (): Template => tpl`
        <p class="note">
            <code>style</code> binds an object of CSS properties (or a
            string). Each change re-applies only the style declaration.
        </p>
        <div
            class="box"
            style=${{
                color: this.state.color,
                'font-size': `${this.state.size}px`,
                background: this.state.bg,
            }}
        >
            Styled box
        </div>
        <button @click=${this.recolor}>color</button>
        <button @click=${this.resize}>size</button>
        <button @click=${this.shade}>background</button>
    `;
}

