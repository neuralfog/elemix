import { Component, silo, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Silo, Template } from '@neuralfog/elemix/types';

type Row = { id: number; label: Silo<string> };

let nextId = 1;

const makeRow = (label: string): Row => ({ id: nextId++, label: silo(label) });

const seed = (): Row[] => [
    makeRow('alpha'),
    makeRow('beta'),
    makeRow('gamma'),
];

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { cursor: pointer; }
    li.danger { color: #b91c1c; font-weight: 700; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class SiloSelectApp extends Component {
    // #styles
    styles = css;

    rows = silo<Row[]>(seed());
    selected = silo<number>(-1);

    select = (e: Event): void => {
        const li = (e.target as HTMLElement).closest('li');
        const id = li?.dataset.id;
        if (id) this.selected.value = Number(id);
    };

    clearSelection = (): void => {
        this.selected.value = -1;
    };

    bumpFirst = (): void => {
        const first = this.rows.value[0];
        if (first) first.label.value += '!';
    };

    append = (): void => {
        this.rows.value.push(makeRow('delta'));
        this.rows.trigger();
    };

    template = (): Template => tpl`
        <span class="sel">${this.selected.value}</span>
        <div class="controls">
            <button class="clear" @click=${this.clearSelection}>clear</button>
            <button class="bump" @click=${this.bumpFirst}>bump</button>
            <button class="append" @click=${this.append}>append</button>
        </div>
        <ul class="rows" @click=${this.select}>
            ${repeat(
                this.rows.value,
                (row) =>
                    tpl`
                        <li
                            class=${row.id === this.selected.value ? 'row danger' : 'row'}
                            data-id=${row.id}
                        >
                            <span class="rid">${row.id}</span>
                            <span class="rlabel">${row.label.value}</span>
                        </li>
                    `,
                (row) => row.id,
            )}
        </ul>
    `;
}
