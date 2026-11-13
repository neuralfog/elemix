import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Item = { id: number; label: string };
type State = { items: Item[] };

// #component
export class MxListTransitions extends Component {
    // #state
    state: State = {
        items: [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
            { id: 3, label: 'c' },
        ],
    };

    private seq = 3;

    clear = (): void => {
        this.state.items = [];
    };

    addOne = (): void => {
        const id = ++this.seq;
        this.state.items.push({ id, label: `n${id}` });
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

    rebuild = (): void => {
        this.seq = 3;
        this.state.items = [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
            { id: 3, label: 'c' },
        ];
    };

    template = (): Template => tpl`
        <div class="wrap">
            <ul class="list">
                ${repeat(
                    this.state.items,
                    (it) => tpl`<li class="row" data-id=${it.id}>${it.label}</li>`,
                    (it) => it.id,
                )}
            </ul>
            <button id="clear" @click=${this.clear}>clear</button>
            <button id="add" @click=${this.addOne}>add</button>
            <button id="reverse" @click=${this.reverse}>reverse</button>
            <button id="swap" @click=${this.swapEnds}>swap</button>
            <button
                id="remove-middle"
                @click=${this.removeMiddle}
            >remove</button>
            <button id="rebuild" @click=${this.rebuild}>rebuild</button>
        </div>
    `;
}
