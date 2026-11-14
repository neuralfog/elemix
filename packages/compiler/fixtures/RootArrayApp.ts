import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class RootArrayApp extends Component {
    // #state
    state: number[] = [1, 2, 3];

    add = (): void => {
        this.state.push(this.state.length + 1);
    };

    template = (): Template => tpl`
        <p class="len">${this.state.length}</p>
        <button @click=${this.add}>add</button>
    `;
}
