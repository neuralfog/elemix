import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class EmptyTrailingHoleApp extends Component {
    // #state
    state: { name: string } = { name: '' };

    fill = (): void => {
        this.state.name = 'World';
    };

    template = (): Template => tpl`
        <p class="greet">Hello ${this.state.name}</p>
        <button @click=${this.fill}>fill</button>
    `;
}
