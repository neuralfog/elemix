import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { DocumentFrame } from './DocumentFrame';

type State = {
    count: number;
};

// #component
export class DocumentPageApp extends Component {
    // #document
    document = DocumentFrame;

    // #state
    state: State = { count: 0 };

    increment = (): void => {
        this.state.count++;
    };

    template = (): Template =>
        tpl`<button @click=${this.increment}>count is ${this.state.count}</button>`;
}
