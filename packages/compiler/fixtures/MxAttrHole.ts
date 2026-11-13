import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { tag: string | null; flag: boolean; n: number };

// #component
export class MxAttrHole extends Component {
    // #state
    state: State = { tag: 'one', flag: true, n: 1 };

    clearTag = (): void => {
        this.state.tag = null;
    };

    setTag = (): void => {
        this.state.tag = 'two';
    };

    toggleFlag = (): void => {
        this.state.flag = !this.state.flag;
    };

    bump = (): void => {
        this.state.n += 1;
    };

    template = (): Template => tpl`
        <div class="wrap">
            <div
                class="box"
                data-static="s"
                data-tag=${this.state.tag}
                data-n=${this.state.n}
                aria-hidden=${this.state.flag}
            >
                <span class="label">box</span>
            </div>
            <button id="clear-tag" @click=${this.clearTag}>clear</button>
            <button id="set-tag" @click=${this.setTag}>set</button>
            <button id="toggle-flag" @click=${this.toggleFlag}>flag</button>
            <button id="bump" @click=${this.bump}>bump</button>
        </div>
    `;
}
