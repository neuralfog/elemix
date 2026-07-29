import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SsrMixedLeaf';

type State = { n: number };

// #component #client
export class SsrMixedClient extends Component {
    // #state
    state: State = { n: 0 };

    bump = (): void => {
        this.state.n++;
    };

    template = (): Template =>
        tpl`<div class="mid">mid <span class="mn">${this.state.n}</span><button class="mb" @click=${this.bump}>mid+</button><ssr-mixed-leaf /></div>`;
}
