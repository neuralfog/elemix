import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    count: number;
};

const css = `.light { color: rgb(255, 0, 0); }`;

// #component #no-shadow
export class NoShadowApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = { count: 0 };

    inc = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`
        <div class="light">
            <span class="count">${this.state.count}</span>
            <button class="inc" @click=${this.inc}>+1</button>
        </div>
    `;
}
