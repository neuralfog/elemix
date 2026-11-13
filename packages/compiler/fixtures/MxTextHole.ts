import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { a: string | number | null; b: string | number | null };

// #component
export class MxTextHole extends Component {
    // #state
    state: State = { a: 'A', b: 'B' };

    aNull = (): void => {
        this.state.a = null;
    };

    aText = (): void => {
        this.state.a = 'A2';
    };

    aEmpty = (): void => {
        this.state.a = '';
    };

    aNum = (): void => {
        this.state.a = 0;
    };

    bLong = (): void => {
        this.state.b = 'BBBBB';
    };

    bNull = (): void => {
        this.state.b = null;
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="run">
                <span class="start">[</span>
                ${this.state.a}
                ${this.state.b}
                <span class="end">]</span>
            </section>
            <button id="a-null" @click=${this.aNull}>a-null</button>
            <button id="a-text" @click=${this.aText}>a-text</button>
            <button id="a-empty" @click=${this.aEmpty}>a-empty</button>
            <button id="a-num" @click=${this.aNum}>a-num</button>
            <button id="b-long" @click=${this.bLong}>b-long</button>
            <button id="b-null" @click=${this.bNull}>b-null</button>
        </div>
    `;
}
