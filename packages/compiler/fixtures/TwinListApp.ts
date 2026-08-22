import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    left: string[];
    right: string[];
};

// #component
export class TwinListApp extends Component {
    // #state
    state: State = {
        left: ['a', 'b', 'c'],
        right: ['x', 'y'],
    };

    addLeft = (): void => {
        this.state.left.push(`l${this.state.left.length}`);
    };

    addRight = (): void => {
        this.state.right.push(`r${this.state.right.length}`);
    };

    template = (): Template => tpl`
        <div class="wrap">
            ${repeat(
                this.state.left,
                (item) => tpl`<span class="left">${item}</span>`,
                (item) => item,
            )}
            ${repeat(
                this.state.right,
                (item) => tpl`<span class="right">${item}</span>`,
                (item) => item,
            )}
        </div>
        <button class="add-left" @click=${this.addLeft}>+left</button>
        <button class="add-right" @click=${this.addRight}>+right</button>
    `;
}
