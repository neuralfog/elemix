import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    count: number;
};

// #component
export class BeforeMountApp extends Component {
    // #state
    state: State = { count: 0 };

    // #before-mount
    seed(): void {
        this.state.count = 999;
    }

    increment = (): void => {
        this.state.count++;
    };

    template = (): Template =>
        tpl`<button @click=${this.increment}>count is ${this.state.count}</button>`;
}
