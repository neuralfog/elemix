import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { outer: boolean; inner: boolean };

// #component
export class MxNestedConditional extends Component {
    // #state
    state: State = { outer: true, inner: true };

    toggleOuter = (): void => {
        this.state.outer = !this.state.outer;
    };

    toggleInner = (): void => {
        this.state.inner = !this.state.inner;
    };

    template = (): Template => tpl`
        <div class="nest">
            <button id="toggle-outer" @click=${this.toggleOuter}>outer</button>
            <button id="toggle-inner" @click=${this.toggleInner}>inner</button>
            ${
                this.state.outer
                    ? tpl`<section class="outer-on">
                          <span class="outer-label">outer</span>
                          ${
                              this.state.inner
                                  ? tpl`<span class="inner-on">inner-on</span>`
                                  : tpl`<span class="inner-off">inner-off</span>`
                          }
                      </section>`
                    : tpl`<p class="outer-off">outer-off</p>`
            }
        </div>
    `;
}
