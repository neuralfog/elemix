import { Component, tpl } from '@neuralfog/elemix';
import { repeat, when } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class FragmentHoleApp extends Component {
    // #state
    state: { show: boolean; items: string[] } = {
        show: true,
        items: ['a', 'b'],
    };

    add = (): void => {
        this.state.items = [...this.state.items, 'c'];
    };

    toggle = (): void => {
        this.state.show = !this.state.show;
    };

    template = (): Template => tpl`
        <div class="box">
            ${when(this.state.show, () => tpl`
                ${repeat(
                    this.state.items,
                    (i) => tpl`<span class="it">${i}</span>`,
                    (i) => i,
                )}
                <span class="tail">tail</span>
            `)}
        </div>
        <button class="add" @click=${this.add}>add</button>
        <button class="toggle" @click=${this.toggle}>toggle</button>
    `;
}
