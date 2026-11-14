import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class CrossRunHolesApp extends Component {
    // #state
    state: { a: string; b: string } = { a: 'A', b: 'B' };

    bump = (): void => {
        this.state.a = 'X';
        this.state.b = 'Y';
    };

    template = (): Template => tpl`
        <p class="pair">
            ${this.state.a}<span class="mid">|</span>${this.state.b}
        </p>
        <button @click=${this.bump}>bump</button>
    `;
}
