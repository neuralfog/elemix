import { Component, silo, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Silo, Template } from '@neuralfog/elemix/types';

type Row = { id: number; label: Silo<string> };

let nextId = 1;

const makeRow = (label: string): Row => ({ id: nextId++, label: silo(label) });

const seed = (): Row[] => [makeRow('alpha'), makeRow('beta')];

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class SiloApp extends Component {
    // #styles
    styles = css;

    rows = silo<Row[]>(seed());
    count = silo(0);

    append = (): void => {
        this.rows.value.push(makeRow('gamma'));
        this.rows.trigger();
    };

    removeFirst = (): void => {
        this.rows.value.shift();
        this.rows.trigger();
    };

    bumpFirst = (): void => {
        const first = this.rows.value[0];
        if (first) first.label.value += '!';
    };

    reset = (): void => {
        nextId = 1;
        this.rows.value = seed();
    };

    inc = (): void => {
        this.count.value++;
    };

    template = (): Template => tpl`
        <span class="count">${this.count.value}</span>
        <div class="controls">
            <button class="append" @click=${this.append}>append</button>
            <button class="remove" @click=${this.removeFirst}>remove</button>
            <button class="bump" @click=${this.bumpFirst}>bump</button>
            <button class="reset" @click=${this.reset}>reset</button>
            <button class="inc" @click=${this.inc}>inc</button>
        </div>
        <ul class="rows">
            ${repeat(
                this.rows.value,
                (row) =>
                    tpl`
                        <li class="row">
                            <span class="rid">${row.id}</span>
                            <span class="rlabel">${row.label.value}</span>
                        </li>
                    `,
                (row) => row.id,
            )}
        </ul>
    `;
}
