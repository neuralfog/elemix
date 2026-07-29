import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    value: number;
};

// #component
export class SsrClientParentChild extends Component<Props> {
    // #state
    state = {
        local: 0,
    };

    tick = (): void => {
        this.state.local++;
    };

    template = (): Template => tpl`<div class="child">
        <span class="from-parent">${this.props.value}</span>
        <span class="local">${this.state.local}</span>
        <button class="tick" @click=${this.tick}>tick</button>
    </div>`;
}
