import { Component, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Row = { id: number; label: string };

type State = {
    rows: Row[];
    selected: number;
};

const A = [
    'pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome',
    'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful',
    'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive',
    'cheap', 'expensive', 'fancy',
];
const C = [
    'red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'white',
    'black', 'orange',
];
const N = [
    'table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie',
    'sandwich', 'burger', 'pizza', 'mouse', 'keyboard',
];

const rnd = (max: number): number => Math.floor(Math.random() * max);

const css = `
    :host {
        display: block;
        font-family: system-ui, sans-serif;
        color: #1e293b;
        font-size: 14px;
    }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .bar button {
        font: inherit;
        font-size: 13px;
        padding: 7px 12px;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
    }
    .bar button:hover { background: #4f46e5; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
    .col-id { width: 60px; color: #94a3b8; }
    .lbl { color: #1e293b; text-decoration: none; cursor: pointer; }
    .remove { color: #ef4444; text-decoration: none; cursor: pointer; font-weight: 700; }
    tr.danger td { background: #fee2e2; }
    tr.danger .lbl { color: #991b1b; font-weight: 700; }
`;

`#component #styles ${css}`
export class BenchApp extends Component {

    state = state<State>({ rows: [], selected: 0 });

    private rowId = 1;

    private buildData(count: number): Row[] {
        const rows: Row[] = new Array(count);
        for (let i = 0; i < count; i++) {
            rows[i] = {
                id: this.rowId++,
                label: `${A[rnd(A.length)]} ${C[rnd(C.length)]} ${N[rnd(N.length)]}`,
            };
        }
        return rows;
    }

    run = (): void => {
        this.state.rows = this.buildData(1000);
    };

    runLots = (): void => {
        this.state.rows = this.buildData(10000);
    };

    add = (): void => {
        this.state.rows.push(...this.buildData(1000));
    };

    update = (): void => {
        const rows = this.state.rows;
        for (let i = 0; i < rows.length; i += 10) {
            rows[i].label += ' !!!';
        }
    };

    clear = (): void => {
        this.state.rows = [];
    };

    swapRows = (): void => {
        const rows = this.state.rows;
        if (rows.length <= 998) return;
        const next = rows.slice();
        const tmp = next[1];
        next[1] = next[998];
        next[998] = tmp;
        this.state.rows = next;
    };

    select = (id: number): void => {
        this.state.selected = id;
    };

    removeRow = (id: number): void => {
        const rows = this.state.rows;
        const index = rows.findIndex((row) => row.id === id);
        if (index !== -1) rows.splice(index, 1);
    };

    template = (): Template => tpl`
        <div class="bar">
            <button @click=${this.run}>Create 1,000 rows</button>
            <button @click=${this.runLots}>Create 10,000 rows</button>
            <button @click=${this.add}>Append 1,000 rows</button>
            <button @click=${this.update}>Update every 10th row</button>
            <button @click=${this.clear}>Clear</button>
            <button @click=${this.swapRows}>Swap Rows</button>
        </div>
        <table>
            <tbody>
                ${repeat(
                    this.state.rows,
                    (row) => tpl`<tr class=${{ danger: this.state.selected === row.id }}>
                        <td class="col-id">${row.id}</td>
                        <td><a class="lbl" @click=${() => this.select(row.id)}>${row.label}</a></td>
                        <td><a class="remove" @click=${() => this.removeRow(row.id)}>×</a></td>
                    </tr>`,
                    (row) => row.id,
                )}
            </tbody>
        </table>
    `;
}

