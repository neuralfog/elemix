import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class DeletePropApp extends Component {
    // #state
    state: { x?: string } = { x: 'present' };

    drop = (): void => {
        delete this.state.x;
    };

    template = (): Template => tpl`
        <p class="val">${this.state.x}</p>
        <button @click=${this.drop}>drop</button>
    `;
}
