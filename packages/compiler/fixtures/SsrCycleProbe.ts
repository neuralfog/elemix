import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { record } from './SsrCycleStore';

type State = { ready: boolean };

// #component
export class SsrCycleProbe extends Component {
    // #state
    state: State = { ready: false };

    // #before-mount
    prepare(): void {
        this.state.ready = true;
        record('before-mount');
    }

    // #mount
    mounted(): void {
        record('mount');
    }

    // #dispose
    cleanup(): void {
        record('dispose');
    }

    template = (): Template =>
        tpl`<span class="status">${this.state.ready ? 'ready' : 'pending'}</span>`;
}
