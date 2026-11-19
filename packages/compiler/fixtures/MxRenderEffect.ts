import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { x: number; runs: number };

// #component
export class MxRenderEffect extends Component {
    // #state
    state: State = { x: 0, runs: 0 };
    label = 'a';

    bump = (): void => {
        this.state.x++;
    };

    paint = (): void => {
        this.label = `${this.label}!`;
        this.render();
    };

    // #effect
    track(): void {
        void this.state.x;
        this.state.runs++;
    }

    template = (): Template => tpl`
        <span class="runs">${this.state.runs}</span>
        <span class="label">${this.label}</span>
        <button class="bump" @click=${this.bump}>bump</button>
        <button class="paint" @click=${this.paint}>paint</button>
    `;
}
