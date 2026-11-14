import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class TemplateHoleApp extends Component {
    // #state
    state: { n: number } = { n: 0 };

    frag = (): Template => tpl`<em class="frag">frag-${this.state.n}</em>`;

    bump = (): void => {
        this.state.n++;
    };

    template = (): Template => tpl`
        <p class="line">tag: ${this.frag()}</p>
        <button @click=${this.bump}>bump</button>
    `;
}
