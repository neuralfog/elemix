import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// Two full components in one file — each gets its own pragma block, its own
// registration, and its own compiled view(). The compiler must lower BOTH
// templates (not bail because it saw more than one).

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
