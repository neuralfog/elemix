import { Component, defineComponent, state } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Item = { id: string; name: string };
type Category = { id: string; name: string; items: Item[] };

type State = {
    categories: Category[];
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 440px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .note {
        margin: 0 0 20px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
        background: #f1f5f9;
        border-left: 3px solid var(--accent);
        border-radius: 8px;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        background: #e2e8f0;
        padding: 1px 5px;
        border-radius: 4px;
    }
    .tree { display: flex; flex-direction: column; gap: 12px; }
    .category { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 10px; }
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f1f5f9;
    }
    .head strong { font-size: 15px; }
    .head button {
        font: inherit;
        font-size: 13px;
        padding: 5px 10px;
        border: none;
        border-radius: 6px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    .head button:hover { background: #4f46e5; }
    ul {
        display: flex;
        flex-direction: column;
        gap: 4px;
        list-style: none;
        margin: 0;
        padding: 8px 14px;
    }
`;

export class NestedApp extends Component {
    static styles = [css];

    state = state<State>({
        categories: [
            {
                id: 'fruit',
                name: 'Fruit',
                items: [
                    { id: 'apple', name: 'Apple' },
                    { id: 'banana', name: 'Banana' },
                ],
            },
            {
                id: 'veg',
                name: 'Vegetables',
                items: [{ id: 'carrot', name: 'Carrot' }],
            },
        ],
    });

    private seq = 0;

    addItem = (category: Category): void => {
        category.items.push({ id: `i${++this.seq}`, name: 'New item' });
    };

    template = (): Template => tpl`
        <p class="note">
            <code>repeat</code> nests: the outer loop renders categories, each
            with its own inner <code>repeat</code> of items. Both levels are
            keyed, so adding an item patches only that one list.
        </p>
        <div class="tree">
            ${repeat(
                this.state.categories,
                (category) => tpl`<div class="category">
                    <div class="head">
                        <strong>${category.name}</strong>
                        <button @click=${() => this.addItem(category)}>+ item</button>
                    </div>
                    <ul>
                        ${repeat(
                            category.items,
                            (item) => tpl`<li>${item.name}</li>`,
                            (item) => item.id,
                        )}
                    </ul>
                </div>`,
                (category) => category.id,
            )}
        </div>
    `;
}

defineComponent('nested-app', NestedApp);
