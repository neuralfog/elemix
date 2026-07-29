import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    counter: { value: number };
};

// #component #client
export class SsrStoreControls extends Component<Props> {
    dec = (): void => {
        this.props.counter.value--;
    };

    inc = (): void => {
        this.props.counter.value++;
    };

    template = (): Template => tpl`<div class="panel">
        <span class="label">Child controls</span>
        <div class="buttons">
            <button class="dec" @click=${this.dec}>−</button>
            <span class="value">${this.props.counter.value}</span>
            <button class="inc" @click=${this.inc}>+</button>
        </div>
    </div>`;
}
