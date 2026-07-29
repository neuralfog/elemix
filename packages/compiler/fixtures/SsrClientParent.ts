import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SsrClientParentChild';

// #component #client
export class SsrClientParent extends Component {
    // #state
    state = {
        n: 0,
    };

    inc = (): void => {
        this.state.n++;
    };

    template = (): Template => tpl`
        <div class="parent">
            <span class="pn">${this.state.n}</span>
            <button class="inc" @click=${this.inc}>inc</button>
        </div>
        <ssr-client-parent-child :value=${this.state.n} />
    `;
}
