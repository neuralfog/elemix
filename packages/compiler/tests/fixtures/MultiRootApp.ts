import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { count: number };

// #component
export class MultiRootApp extends Component {
    // #state
    state: State = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template(): Template {
        return tpl`
            <div class="stack">
                ${
                    this.state.count < 0
                        ? tpl`<div class="empty">empty</div>`
                        : tpl`<div class="a">a${this.state.count}</div><div class="b">b</div>`
                }
            </div>
            <button class="inc" @click=${this.inc}>+1</button>
        `;
    }
}
