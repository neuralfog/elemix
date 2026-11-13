import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Item = { id: number; label: string };
type State = { show: boolean; items: Item[] };

// #component
export class MxListInConditional extends Component {
    // #state
    state: State = {
        show: true,
        items: [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
        ],
    };

    private seq = 2;

    toggle = (): void => {
        this.state.show = !this.state.show;
    };

    addOne = (): void => {
        const id = ++this.seq;
        this.state.items.push({ id, label: `n${id}` });
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="host">
                ${this.state.show
                    ? tpl`<ul class="list">${repeat(
                          this.state.items,
                          (it) =>
                              tpl`<li class="row" data-id=${it.id}>${it.label}</li>`,
                          (it) => it.id,
                      )}</ul>`
                    : ''}
            </section>
            <button id="toggle" @click=${this.toggle}>toggle</button>
            <button id="add" @click=${this.addOne}>add</button>
        </div>
    `;
}
