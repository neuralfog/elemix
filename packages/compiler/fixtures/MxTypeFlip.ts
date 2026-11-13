import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Mode = 'text' | 'markup' | 'null';
type Val = string | Template | null;
type State = { left: Mode; right: Mode };

// #component
export class MxTypeFlip extends Component {
    // #state
    state: State = { left: 'text', right: 'markup' };

    private get left(): Val {
        const m = this.state.left;
        if (m === 'text') return 'tL';
        if (m === 'markup') return tpl`<b class="bL">mL</b>`;
        return null;
    }

    private get right(): Val {
        const m = this.state.right;
        if (m === 'text') return 'tR';
        if (m === 'markup') return tpl`<i class="bR">mR</i>`;
        return null;
    }

    leftText = (): void => {
        this.state.left = 'text';
    };

    leftMarkup = (): void => {
        this.state.left = 'markup';
    };

    leftNull = (): void => {
        this.state.left = 'null';
    };

    rightText = (): void => {
        this.state.right = 'text';
    };

    rightMarkup = (): void => {
        this.state.right = 'markup';
    };

    rightNull = (): void => {
        this.state.right = 'null';
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="mix">
                <span class="start">[</span> ${this.left} ${this.right}
                <span class="end">]</span>
            </section>
            <button id="l-text" @click=${this.leftText}>l-text</button>
            <button id="l-markup" @click=${this.leftMarkup}>l-markup</button>
            <button id="l-null" @click=${this.leftNull}>l-null</button>
            <button id="r-text" @click=${this.rightText}>r-text</button>
            <button id="r-markup" @click=${this.rightMarkup}>r-markup</button>
            <button id="r-null" @click=${this.rightNull}>r-null</button>
        </div>
    `;
}
