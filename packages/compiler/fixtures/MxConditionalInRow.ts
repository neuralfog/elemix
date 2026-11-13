import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Item = { id: number; label: string; open: boolean; detail: string };
type State = { items: Item[] };

// #component
export class MxConditionalInRow extends Component {
    // #state
    state: State = {
        items: [
            { id: 1, label: 'a', open: true, detail: 'da' },
            { id: 2, label: 'b', open: false, detail: 'db' },
            { id: 3, label: 'c', open: false, detail: 'dc' },
        ],
    };

    toggleRow = (id: number): void => {
        const row = this.state.items.find((it) => it.id === id);
        if (row) row.open = !row.open;
    };

    reverse = (): void => {
        this.state.items.reverse();
    };

    template = (): Template => tpl`
        <div class="wrap">
            <ul class="list">
                ${repeat(
                    this.state.items,
                    (it) => tpl`
                        <li class="row" data-id=${it.id}>
                            <span class="lbl">${it.label}</span> ${it.open
                            ? tpl`<span class="detail">${it.detail}</span>`
                            : ''} <button
                                class="row-toggle"
                                @click=${() => this.toggleRow(it.id)}
                            >t</button>
                        </li>
                    `,
                    (it) => it.id,
                )}
            </ul>
            <button id="reverse" @click=${this.reverse}>reverse</button>
        </div>
    `;
}
