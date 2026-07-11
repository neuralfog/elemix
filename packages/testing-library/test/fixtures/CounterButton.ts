import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class CounterButton extends Component {
    // #state
    state = { count: 0 };

    increment = (): void => {
        this.state.count++;
    };

    template = (): Template =>
        tpl`<button class="btn" @click=${this.increment}>count is ${this.state.count}</button>`;
}
