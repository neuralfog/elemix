import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Row = { id: number; name: string };

type State = {
    rows: Row[];
    log: string;
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .log { display: block; margin-bottom: 8px; font-family: ui-monospace, monospace; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .label { cursor: pointer; }
`;

// #component
export class DelegationSweepApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        rows: [
            { id: 1, name: 'alpha' },
            { id: 2, name: 'bravo' },
            { id: 3, name: 'charlie' },
            { id: 4, name: 'delta' },
        ],
        log: '',
    };

    private seq = 4;

    add = (): void => {
        const id = ++this.seq;
        this.state.rows.push({ id, name: `row-${id}` });
        this.state.log = `add:${id}`;
    };

    select = (id: number): void => {
        this.state.log = `select:${id}`;
    };

    removeRow = (id: number): void => {
        const i = this.state.rows.findIndex((r) => r.id === id);
        if (i !== -1) this.state.rows.splice(i, 1);
        this.state.log = `remove:${id}`;
    };

    star = (id: number): void => {
        this.state.log = `star:${id}`;
    };

    type = (id: number, value: string): void => {
        this.state.log = `type:${id}:${value}`;
    };

    key = (id: number, k: string): void => {
        this.state.log = `key:${id}:${k}`;
    };

    blurred = (id: number): void => {
        this.state.log = `blur:${id}`;
    };

    template = (): Template => tpl`
        <button id="add" @click=${this.add}>add</button>
        <output class="log">${this.state.log}</output>
        <ul class="rows">
            ${repeat(
                this.state.rows,
                (row) => tpl`
                    <li class="row" data-id=${row.id}>
                        <span
                            class="label"
                            @click=${() => this.select(row.id)}
                        >${row.name}</span>
                        <button
                            class="rm"
                            @click=${() => this.removeRow(row.id)}
                        >x</button>
                        <button
                            class="star"
                            @dblclick=${() => this.star(row.id)}
                        >star</button>
                        <input
                            class="edit"
                            @input=${(e: Event) =>
                            this.type(
                                row.id,
                                (e.currentTarget as HTMLInputElement).value,
                            )}
                            @keydown=${(e: KeyboardEvent) => this.key(row.id, e.key)}
                            @blur=${() => this.blurred(row.id)}
                        />
                    </li>
                `,
                (row) => row.id,
            )}
        </ul>
    `;
}
