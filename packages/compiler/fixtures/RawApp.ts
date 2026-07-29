import { Component, raw, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

class Stopwatch {
    #ticks = 0;

    tick(): void {
        this.#ticks++;
    }

    get ticks(): number {
        return this.#ticks;
    }
}

type Row = { id: string; label: string };

type State = {
    sw: Stopwatch;
    count: number;
    rows: Row[];
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class RawApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        sw: raw(new Stopwatch()),
        count: 0,
        rows: [{ id: 'a', label: 'A' }],
    };

    tickRaw = (): void => {
        this.state.sw.tick();
    };

    refresh = (): void => {
        this.render();
    };

    inc = (): void => {
        this.state.count++;
    };

    addRow = (): void => {
        this.state.rows.push({ id: 'b', label: 'B' });
    };

    template = (): Template => tpl`
        <span class="ticks">${this.state.sw.ticks}</span>
        <span class="count">${this.state.count}</span>
        <div class="controls">
            <button class="tick" @click=${this.tickRaw}>tick</button>
            <button class="refresh" @click=${this.refresh}>refresh</button>
            <button class="inc" @click=${this.inc}>inc</button>
            <button class="add-row" @click=${this.addRow}>row</button>
        </div>
        <ul class="rows">
            ${repeat(
                this.state.rows,
                (row) =>
                    tpl`<li class="row"><span class="rid">${row.id}</span><span class="rlabel">${row.label}</span></li>`,
                (row) => row.id,
            )}
        </ul>
    `;
}
