import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    count: number;
};

// #component
export class EffectApp extends Component {
    // #state
    state: State = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    // #effect
    mirror(): void {
        this.setAttribute('data-count', String(this.state.count));
    }

    // #effect
    report(): void {
        const count = this.state.count;
        if (!this.isMounted) return;
        this.setAttribute('data-changed', String(count));
    }

    template = (): Template => tpl`
        <div class="effect">
            <span class="count">${this.state.count}</span>
            <button class="inc" @click=${this.inc}>+1</button>
        </div>
    `;
}
