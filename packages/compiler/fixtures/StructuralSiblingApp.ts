import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class StructuralSiblingApp extends Component {
    // #state
    state: { a: string; open: boolean } = { a: 'A', open: true };

    toggle = (): void => {
        this.state.open = !this.state.open;
    };

    template = (): Template => tpl`
        <p class="line">
            Label: ${this.state.a}
            ${this.state.open ? tpl`<b class="flag">x</b>` : ''}
        </p>
        <button @click=${this.toggle}>toggle</button>
    `;
}
