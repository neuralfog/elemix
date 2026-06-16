import { Component, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Row = { id: number; name: string };

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    button {
        font: inherit;
        padding: 4px 10px;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
        margin-bottom: 8px;
    }
    ul { list-style: none; margin: 0; padding: 0; }
    .row { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
`;

// A parameterized helper template — `row` takes an item and returns a template,
// called as `this.row(r)` inside a repeat. Splice must inline it, substituting
// the helper param `item` for the call's arg `r`, so the holes become r.id / r.name.
`#component #styles ${css}`
export class RowList extends Component {
    state = state<{ rows: Row[] }>({
        rows: [
            { id: 1, name: 'alpha' },
            { id: 2, name: 'beta' },
        ],
    });

    add = (): void => {
        this.state.rows.push({ id: this.state.rows.length + 1, name: 'new' });
    };

    row = (item: Row): Template =>
        tpl`<li class="row" data-id=${item.id}>${item.name}</li>`;

    template = (): Template =>
        tpl`<div>
            <button class="add" @click=${this.add}>add row</button>
            <ul class="list">
                ${repeat(this.state.rows, (r) => this.row(r), (r) => r.id)}
            </ul>
        </div>`;
}
