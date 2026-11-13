import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { a: boolean; b: boolean; c: boolean };

// #component
export class MxSiblingHoles extends Component {
    // #state
    state: State = { a: true, b: true, c: true };

    toggleA = (): void => {
        this.state.a = !this.state.a;
    };

    toggleB = (): void => {
        this.state.b = !this.state.b;
    };

    toggleC = (): void => {
        this.state.c = !this.state.c;
    };

    private get holeA(): Template | null {
        return this.state.a ? tpl`<i class="hole a">A</i>` : null;
    }

    private get holeB(): Template | null {
        return this.state.b ? tpl`<i class="hole b">B</i>` : null;
    }

    private get holeC(): Template | null {
        return this.state.c ? tpl`<i class="hole c">C</i>` : null;
    }

    template = (): Template => tpl`
        <div class="row">
            <button id="toggle-a" @click=${this.toggleA}>a</button>
            <button id="toggle-b" @click=${this.toggleB}>b</button>
            <button id="toggle-c" @click=${this.toggleC}>c</button>
            <section class="holes">
                <span class="start">[</span>
                ${this.holeA}
                ${this.holeB}
                ${this.holeC}
                <span class="end">]</span>
            </section>
        </div>
    `;
}
