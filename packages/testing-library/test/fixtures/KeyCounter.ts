import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class KeyCounter extends Component {
    // #state
    state = { keys: 0, inputs: 0, changes: 0 };

    onKey = (): void => {
        this.state.keys++;
    };

    onInput = (): void => {
        this.state.inputs++;
    };

    onChange = (): void => {
        this.state.changes++;
    };

    template = (): Template => tpl`
        <input
            class="probe"
            @keydown=${this.onKey}
            @input=${this.onInput}
            @change=${this.onChange}
        />
        <span class="keys">${this.state.keys}</span>
        <span class="inputs">${this.state.inputs}</span>
        <span class="changes">${this.state.changes}</span>
    `;
}
