import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Todo = { id: string; text: string; done: boolean };

// #component
export class TodoItem extends Component<{ todo: Todo; remove: () => void }> {
    // #state
    state = { hovered: false };

    toggle = (): void => {
        this.props.todo.done = !this.props.todo.done;
    };

    template = (): Template => tpl`
        <div class="item ${this.props.todo.done ? 'is-done' : ''}">
            <button class="check" @click=${this.toggle}>
                ${this.props.todo.done ? '✓' : ''}
            </button>
            <input ~model=${this.state} :disabled=${this.props.todo.done} />
            <span class="text">${this.props.todo.text}</span>
            <button class="remove" @click=${this.props.remove}>×</button>
        </div>
    `;
}
