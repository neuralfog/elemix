import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { n: number };

// #component
export class SsrMixedLeaf extends Component {
    // #state
    state: State = { n: 0 };

    bump = (): void => {
        this.state.n++;
    };

    template = (): Template =>
        tpl`<div class="leaf">leaf <span class="ln">${this.state.n}</span><button class="lb" @click=${this.bump}>leaf+</button></div>`;
}
