import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { counter } from './SignalStore';

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .buttons { display: flex; justify-content: center; gap: 10px; }
    button {
        font: inherit;
        font-size: 16px;
        min-width: 48px;
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
`;

`#component #styles ${css}`
export class SignalButtons extends Component {

    dec = (): void => {
        counter.count--;
    };

    reset = (): void => {
        counter.count = 0;
    };

    inc = (): void => {
        counter.count++;
    };

    template = (): Template => tpl`<div class="buttons">
        <button @click=${this.dec}>−</button>
        <button @click=${this.reset}>Reset</button>
        <button @click=${this.inc}>+</button>
    </div>`;
}

