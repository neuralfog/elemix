import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Store = {
    count: number;
};

// #state
export const counter: Store = { count: 0 };

// #component
export class BeforeMountStoreApp extends Component {
    // #before-mount
    seed(): void {
        counter.count = 999;
    }

    increment = (): void => {
        counter.count++;
    };

    template = (): Template =>
        tpl`<button @click=${this.increment}>count is ${counter.count}</button>`;
}
