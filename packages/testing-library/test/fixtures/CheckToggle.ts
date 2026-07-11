import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class CheckToggle extends Component {
    // #state
    state = { on: false };

    onChange = (e: Event): void => {
        this.state.on = (e.target as HTMLInputElement).checked;
    };

    template = (): Template => tpl`
        <input class="cb" type="checkbox" @change=${this.onChange} />
        <span class="status">${this.state.on}</span>
    `;
}
