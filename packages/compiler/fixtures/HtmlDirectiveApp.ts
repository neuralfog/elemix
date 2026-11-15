import { Component, tpl } from '@neuralfog/elemix';
import { html } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

const BOLD = '<strong class="m">bold</strong> raw';
const ITALIC = '<em class="m">italic</em> raw';

// #component
export class HtmlDirectiveApp extends Component {
    // #state
    state = { active: 'bold' };

    swap = (): void => {
        this.state.active = 'italic';
    };

    template = (): Template => tpl`
        <div>
            <div id="sink">
                ${html(this.state.active === 'bold' ? BOLD : ITALIC)}
            </div>
            <button id="swap" @click=${this.swap}>swap</button>
        </div>
    `;
}
