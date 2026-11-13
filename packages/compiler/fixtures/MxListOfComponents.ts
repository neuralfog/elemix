import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './MxCounterChild';

type Item = { id: number; label: string };
type State = { items: Item[] };

// #component
export class MxListOfComponents extends Component {
    // #state
    state: State = {
        items: [
            { id: 1, label: 'x' },
            { id: 2, label: 'y' },
            { id: 3, label: 'z' },
        ],
    };

    reverse = (): void => {
        this.state.items.reverse();
    };

    swapEnds = (): void => {
        const list = this.state.items;
        if (list.length < 2) return;
        const first = list[0];
        list[0] = list[list.length - 1];
        list[list.length - 1] = first;
    };

    removeMiddle = (): void => {
        const list = this.state.items;
        if (list.length === 0) return;
        list.splice(Math.floor(list.length / 2), 1);
    };

    clear = (): void => {
        this.state.items = [];
    };

    template = (): Template => tpl`
        <div class="wrap">
            <div class="list">
                ${repeat(
                    this.state.items,
                    (it) =>
                        tpl`<mx-counter-child data-id=${it.id} :label=${it.label}></mx-counter-child>`,
                    (it) => it.id,
                )}
            </div>
            <button id="reverse" @click=${this.reverse}>reverse</button>
            <button id="swap" @click=${this.swapEnds}>swap</button>
            <button id="remove-middle" @click=${this.removeMiddle}>remove</button>
            <button id="clear" @click=${this.clear}>clear</button>
        </div>
    `;
}
