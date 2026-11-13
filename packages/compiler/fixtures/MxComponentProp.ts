import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './MxCounterChild';

type State = { label: string; which: 'a' | 'b' };

// #component
export class MxComponentProp extends Component {
    // #state
    state: State = { label: 'p1', which: 'a' };

    rename = (): void => {
        this.state.label = 'p2';
    };

    swap = (): void => {
        this.state.which = this.state.which === 'a' ? 'b' : 'a';
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="host">
                ${this.state.which === 'a'
                ? tpl`
                    <mx-counter-child
                        class="slot-a"
                        :label=${this.state.label}
                    ></mx-counter-child>
                `
                : tpl`
                    <mx-counter-child
                        class="slot-b"
                        :label=${`b-${this.state.label}`}
                    ></mx-counter-child>
                `}
            </section>
            <button id="rename" @click=${this.rename}>rename</button>
            <button id="swap" @click=${this.swap}>swap</button>
        </div>
    `;
}
