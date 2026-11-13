import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { showEmpty: boolean; showNull: boolean; tick: number };

// #component
export class MxConditionalChurn extends Component {
    // #state
    state: State = { showEmpty: true, showNull: true, tick: 0 };

    toggleEmpty = (): void => {
        this.state.showEmpty = !this.state.showEmpty;
    };

    toggleNull = (): void => {
        this.state.showNull = !this.state.showNull;
    };

    bump = (): void => {
        this.state.tick += 1;
    };

    template = (): Template => tpl`
        <div class="churn">
            <button id="toggle-empty" @click=${this.toggleEmpty}>empty</button>
            <button id="toggle-null" @click=${this.toggleNull}>null</button>
            <button id="tick" @click=${this.bump}>tick</button>
            <span class="count">${this.state.tick}</span> ${
                this.state.showEmpty
                    ? tpl`<span class="e-on">e${this.state.tick}</span>`
                    : ''
            } ${
                this.state.showNull
                    ? tpl`<span class="n-on">n${this.state.tick}</span>`
                    : null
            }
        </div>
    `;
}
