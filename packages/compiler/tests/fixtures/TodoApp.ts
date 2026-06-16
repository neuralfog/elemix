import { Component, ref, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Ref, Template } from '@neuralfog/elemix/types';

type Todo = { id: string; text: string };

type State = {
    draft: Ref<string>;
    todos: Todo[];
};

const css = `
    :host {
        --accent: #6366f1;
        --accent-hover: #4f46e5;
        --danger: #ef4444;
        --surface: #f1f5f9;
        --border: #cbd5e1;
        --text: #1e293b;
        display: block;
        margin-bottom: 24px;
        font-family: system-ui, sans-serif;
        color: var(--text);
    }
    h3 { margin: 0 0 12px; }
    .row { display: flex; gap: 8px; margin-bottom: 16px; }
    input {
        flex: 1;
        font: inherit;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        outline: none;
    }
    input:focus { border-color: var(--accent); }
    button { font: inherit; border: none; border-radius: 8px; cursor: pointer; }
    .add { padding: 8px 16px; background: var(--accent); color: white; }
    .add:hover { background: var(--accent-hover); }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--surface);
        border-radius: 8px;
    }
    .remove {
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        background: transparent;
        color: var(--danger);
        font-size: 18px;
        line-height: 1;
    }
    .remove:hover { background: rgba(239, 68, 68, 0.12); }
`;

// #component
export class TodoApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        draft: ref(''),
        todos: [{ id: 't0', text: 'Learn Elemix' }],
    };

    private seq = 0;

    addItem = (): void => {
        const value = this.state.draft.value.trim();
        if (!value) return;
        this.state.todos.push({ id: `t${++this.seq}`, text: value });
        this.state.draft.value = '';
    };

    removeItem = (id: string): void => {
        const index = this.state.todos.findIndex((todo) => todo.id === id);
        if (index !== -1) this.state.todos.splice(index, 1);
    };

    template = (): Template => tpl`
        <h3>Todos</h3>
        <div class="row">
            <input
                type="text"
                placeholder="What needs doing?"
                ~model=${this.state.draft}
                @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') this.addItem();
                }}
            />
            <button class="add" @click=${this.addItem}>Add</button>
        </div>
        <ul>
            ${repeat(
                this.state.todos,
                (todo) => tpl`
                    <li>
                        <span>${todo.text}</span>
                        <button class="remove" @click=${() => this.removeItem(todo.id)}>×</button>
                    </li>
                `,
                (todo) => todo.id,
            )}
        </ul>
    `;
}

