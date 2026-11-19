import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Row = { id: number; label: string; on: boolean };

// #component
export class MxRenderList extends Component {
    rows: Row[] = [
        { id: 1, label: 'one', on: false },
        { id: 2, label: 'two', on: false },
        { id: 3, label: 'three', on: false },
    ];
    next = 4;

    edit = (): void => {
        this.rows[1].label = `${this.rows[1].label}!`;
        this.render();
    };

    toggle = (): void => {
        this.rows[1].on = !this.rows[1].on;
        this.render();
    };

    add = (): void => {
        this.rows.push({ id: this.next++, label: 'new', on: false });
        this.render();
    };

    drop = (): void => {
        this.rows = this.rows.filter((r) => r.id !== 2);
        this.render();
    };

    swap = (): void => {
        const a = this.rows[0];
        this.rows[0] = this.rows[this.rows.length - 1];
        this.rows[this.rows.length - 1] = a;
        this.render();
    };

    wipe = (): void => {
        this.rows = [];
        this.render();
    };

    template = (): Template => tpl`
        <ul class="rows">
            ${repeat(
                this.rows,
                (r) => tpl`
                    <li class=${r.on ? 'on' : 'off'} data-id=${r.id}>
                        ${r.label}
                    </li>
                `,
                (r) => r.id,
            )}
        </ul>
        <button class="edit" @click=${this.edit}>edit</button>
        <button class="toggle" @click=${this.toggle}>toggle</button>
        <button class="add" @click=${this.add}>add</button>
        <button class="drop" @click=${this.drop}>drop</button>
        <button class="swap" @click=${this.swap}>swap</button>
        <button class="wipe" @click=${this.wipe}>wipe</button>
    `;
}
