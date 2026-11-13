import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './MxCounterChild';

type Item = { id: number; label: string; flag: boolean; x: number };
type State = { show: boolean; items: Item[] };

// #component
export class MxDeepNest extends Component {
    // #state
    state: State = {
        show: true,
        items: [
            { id: 1, label: 'a', flag: true, x: 1 },
            { id: 2, label: 'b', flag: false, x: 2 },
        ],
    };

    private seq = 2;

    toggleShow = (): void => {
        this.state.show = !this.state.show;
    };

    addOne = (): void => {
        const id = ++this.seq;
        this.state.items.push({ id, label: `n${id}`, flag: false, x: id });
    };

    reverse = (): void => {
        this.state.items.reverse();
    };

    toggleFlag = (id: number): void => {
        const row = this.state.items.find((it) => it.id === id);
        if (row) row.flag = !row.flag;
    };

    bumpX = (id: number): void => {
        const row = this.state.items.find((it) => it.id === id);
        if (row) row.x += 1;
    };

    template = (): Template => tpl`
        <div class="wrap">
            <section class="host">
                ${this.state.show
                    ? tpl`<ul class="list">${repeat(
                          this.state.items,
                          (it) => tpl`<li class="row" data-id=${it.id}>
                              <mx-counter-child :label=${it.label}></mx-counter-child>
                              ${it.flag ? tpl`<em class="x">${it.x}</em>` : ''}
                              <button class="flag" @click=${() => this.toggleFlag(it.id)}>f</button>
                              <button class="x-bump" @click=${() => this.bumpX(it.id)}>x</button>
                          </li>`,
                          (it) => it.id,
                      )}</ul>`
                    : ''}
            </section>
            <button id="toggle-show" @click=${this.toggleShow}>show</button>
            <button id="add" @click=${this.addOne}>add</button>
            <button id="reverse" @click=${this.reverse}>reverse</button>
        </div>
    `;
}
