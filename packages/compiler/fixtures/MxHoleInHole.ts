import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { outer: boolean; inner: boolean; n: number };

// #component
export class MxHoleInHole extends Component {
    // #state
    state: State = { outer: true, inner: true, n: 1 };

    private get innerTpl(): Template | null {
        return this.state.inner
            ? tpl`<span class="inner">i${this.state.n}</span>`
            : null;
    }

    private get outerTpl(): Template | null {
        return this.state.outer
            ? tpl`
                <div class="outer">
                    <span class="o-label">o</span>${this.innerTpl}
                </div>
            `
            : null;
    }

    toggleInner = (): void => {
        this.state.inner = !this.state.inner;
    };

    toggleOuter = (): void => {
        this.state.outer = !this.state.outer;
    };

    bump = (): void => {
        this.state.n += 1;
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="host">${this.outerTpl}</section>
            <button id="toggle-inner" @click=${this.toggleInner}>inner</button>
            <button id="toggle-outer" @click=${this.toggleOuter}>outer</button>
            <button id="bump" @click=${this.bump}>bump</button>
        </div>
    `;
}
