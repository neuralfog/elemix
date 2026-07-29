import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { count: number };

const css = `
    :host {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 6px;
        font-family: system-ui, sans-serif;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    button {
        font: inherit;
        font-size: 18px;
        line-height: 1;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    button:hover { background: #4f46e5; }
    button:active { transform: translateY(1px); }
    .count {
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 24px;
        min-width: 2.5ch;
        height: 34px;
        text-align: center;
        color: #1e293b;
    }
`;

// An explicit `#tag` that overrides the derived one (`StepperWidget` would
// otherwise become `stepper-widget`). The pragma is a plain `//` comment bound
// to the class on the next line.
// #component #tag ui-stepper
export class StepperWidget extends Component {
    // #styles
    styles = css;
    // #state
    state: State = { count: 0 };

    dec = (): void => {
        this.state.count--;
    };

    inc = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`<div class="stepper">
        <button @click=${this.dec}>−</button>
        <span class="count">${this.state.count}</span>
        <button @click=${this.inc}>+</button>
    </div>`;
}
