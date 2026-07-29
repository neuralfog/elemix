import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { count: number };

// #component
export class MethodApp extends Component {
    // #state
    state: State = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template(): Template {
        const label = 'count';
        return tpl`
            <div class="method">
                <span class="lbl">${label}</span>
                <span class="count">${this.state.count}</span>
                <button class="inc" @click=${this.inc}>+1</button>
            </div>
        `;
    }
}
