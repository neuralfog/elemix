import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { NavDocument } from './NavDocument';

// #component
export class NavHomeApp extends Component {
    // #document
    document = NavDocument;

    // #state
    state = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`
        <main id="page" data-page="home">
            <h1>Home</h1>
            <button id="counter" @click=${this.inc}>count ${this.state.count}</button>
        </main>
    `;
}
