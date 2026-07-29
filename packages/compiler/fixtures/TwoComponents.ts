import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class FirstWidget extends Component {
    // #state
    state: { n: number } = { n: 1 };
    inc = (): void => {
        this.state.n++;
    };
    template = (): Template =>
        tpl`<button class="first" @click=${this.inc}>${this.state.n}</button>`;
}

// #component
export class SecondWidget extends Component {
    // #state
    state: { label: string } = { label: 'hi' };
    flip = (): void => {
        this.state.label = this.state.label === 'hi' ? 'bye' : 'hi';
    };
    template = (): Template =>
        tpl`<button class="second" @click=${this.flip}>${this.state.label}</button>`;
}
