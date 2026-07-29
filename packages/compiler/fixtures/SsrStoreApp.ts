import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SsrStoreControls';

type State = {
    counter: { value: number };
};

// #component
export class SsrStoreApp extends Component {
    // #state
    state: State = {
        counter: { value: 0 },
    };

    template = (): Template => tpl`
        <div class="readout">Parent reads: <strong>${this.state.counter.value}</strong></div>
        <ssr-store-controls :counter=${this.state.counter} />
    `;
}
