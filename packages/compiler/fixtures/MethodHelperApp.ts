import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { open: boolean; count: number };

// #component
export class MethodHelperApp extends Component {
    // #state
    state: State = { open: true, count: 0 };

    toggle = (): void => {
        this.state.open = !this.state.open;
    };

    inc = (): void => {
        this.state.count++;
    };

    private chip = (label: string): Template =>
        tpl`<span class="chip">${label}</span>`;

    template(): Template {
        return tpl`
            <div class="panel">
                <div class="row">${this.chip('a')}${this.chip('b')}</div>
                ${
                    this.state.open
                        ? tpl`<div class="open">${this.chip('open')}<span class="count">${this.state.count}</span></div>`
                        : tpl`<div class="closed">closed</div>`
                }
                <button class="toggle" @click=${this.toggle}>toggle</button>
                <button class="inc" @click=${this.inc}>+1</button>
            </div>
        `;
    }
}
