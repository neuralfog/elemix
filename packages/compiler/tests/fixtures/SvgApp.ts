import { Component, defineComponent, state } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    cx: number;
    cy: number;
    r: number;
    color: string;
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
    svg { display: block; background: #f8fafc; border-radius: 12px; margin-bottom: 14px; }
    button { font: inherit; font-size: 13px; padding: 6px 12px; margin-right: 8px; border: none; border-radius: 8px; background: #e2e8f0; cursor: pointer; }
    button:hover { background: #cbd5e1; }
`;

const COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b'];

export class SvgApp extends Component {
    static styles = [css];

    state = state<State>({
        cx: 100,
        cy: 100,
        r: 40,
        color: COLORS[0],
    });

    private colorIndex = 0;

    move = (): void => {
        this.state.cx = this.state.cx === 100 ? 60 : 100;
        this.state.cy = this.state.cy === 100 ? 140 : 100;
    };

    grow = (): void => {
        this.state.r = this.state.r >= 80 ? 20 : this.state.r + 20;
    };

    recolor = (): void => {
        this.colorIndex = (this.colorIndex + 1) % COLORS.length;
        this.state.color = COLORS[this.colorIndex];
    };

    template = (): Template => tpl`
        <p class="note">
            SVG elements parse into the SVG namespace and bind through
            <code>_attr</code> like any other attribute (cx/cy/r/fill via
            setAttribute).
        </p>
        <svg viewBox="0 0 200 200" width="200" height="200">
            <circle cx=${this.state.cx} cy=${this.state.cy} r=${this.state.r} fill=${this.state.color} />
        </svg>
        <button @click=${this.move}>move</button>
        <button @click=${this.grow}>grow</button>
        <button @click=${this.recolor}>recolor</button>
    `;
}

defineComponent('svg-app', SvgApp);
