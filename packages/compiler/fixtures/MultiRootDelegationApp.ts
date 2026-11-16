import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Cell = { id: number; n: number };

type State = {
    cells: Cell[];
    log: string;
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .log { display: block; margin-bottom: 8px; font-family: ui-monospace, monospace; }
    .cells { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: auto auto auto; gap: 4px 8px; width: max-content; }
    button { cursor: pointer; }
`;

// #component
export class MultiRootDelegationApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        cells: [
            { id: 1, n: 0 },
            { id: 2, n: 0 },
            { id: 3, n: 0 },
        ],
        log: '',
    };

    bump = (id: number, by: number): void => {
        const cell = this.state.cells.find((c) => c.id === id);
        if (cell) cell.n += by;
        this.state.log = `bump:${id}:${by}`;
    };

    tap = (id: number, detail: string): void => {
        this.state.log = `tap:${id}:${detail}`;
    };

    template = (): Template => tpl`
        <output class="log">${this.state.log}</output>
        <ul class="cells">
            ${repeat(
                this.state.cells,
                (cell) => tpl`
                    <button
                        class="up"
                        data-id=${cell.id}
                        @click=${() => this.bump(cell.id, 1)}
                    >+</button>
                    <span class="val" data-id=${cell.id}>${cell.n}</span>
                    <button
                        class="down"
                        data-id=${cell.id}
                        @click=${() => this.bump(cell.id, -1)}
                        @custom-tap=${(e: Event) =>
                        this.tap(cell.id, String((e as CustomEvent).detail))}
                    >-</button>
                `,
                (cell) => cell.id,
            )}
        </ul>
    `;
}
