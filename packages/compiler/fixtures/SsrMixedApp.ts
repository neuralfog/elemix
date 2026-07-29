import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SsrMixedClient';

type State = { n: number };

// #component
export class SsrMixedApp extends Component {
    // #state
    state: State = { n: 0 };

    bump = (): void => {
        this.state.n++;
    };

    template = (): Template =>
        tpl`<div class="outer">outer <span class="on">${this.state.n}</span><button class="ob" @click=${this.bump}>outer+</button><ssr-mixed-client /></div>`;
}
