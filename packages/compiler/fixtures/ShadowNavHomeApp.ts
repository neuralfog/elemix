import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { ShadowNavDocument } from './ShadowNavDocument';
import './ShadowNavShell';

// #component
export class ShadowNavHomeApp extends Component {
    // #document
    document = ShadowNavDocument;

    // #state
    state = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`
        <shadow-nav-shell></shadow-nav-shell>
        <main id="page" data-page="home">
            <h1>Home</h1>
            <button id="counter" @click=${this.inc}>count ${this.state.count}</button>
        </main>
    `;
}
