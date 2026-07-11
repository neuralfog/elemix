import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class GuardedInput extends Component {
    // #state
    state = { typed: 0 };

    block = (e: Event): void => {
        e.preventDefault();
    };

    onInput = (): void => {
        this.state.typed++;
    };

    template = (): Template => tpl`
        <input class="guarded" @beforeinput=${this.block} @input=${this.onInput} />
        <span class="typed">${this.state.typed}</span>
    `;
}
