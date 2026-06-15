import { Component, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './UserCard';

type User = { id: number; name: string; role: string };

type State = {
    users: User[];
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
        margin: 0 0 16px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
        background: #f1f5f9;
        border-left: 3px solid var(--accent);
        border-radius: 8px;
    }
    code { font-family: ui-monospace, monospace; font-size: 12px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px; }
    .bar { display: flex; gap: 8px; margin-bottom: 14px; }
    .bar button { font: inherit; font-size: 13px; padding: 6px 12px; border: none; border-radius: 8px; background: var(--accent); color: white; cursor: pointer; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; align-items: center; gap: 8px; }
    .row user-card { flex: 1; }
    .row .promote, .row .drop {
        font: inherit;
        font-size: 12px;
        padding: 6px 8px;
        border: none;
        border-radius: 8px;
        background: #e2e8f0;
        cursor: pointer;
    }
`;

const NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara'];

`#component #styles ${css}`
export class CardListApp extends Component {

    state = state<State>({
        users: [
            { id: 1, name: 'Ada', role: 'Engineer' },
            { id: 2, name: 'Grace', role: 'Engineer' },
        ],
    });

    private seq = 2;

    add = (): void => {
        const id = ++this.seq;
        this.state.users.push({
            id,
            name: NAMES[id % NAMES.length],
            role: 'Engineer',
        });
    };

    promote = (id: number): void => {
        const user = this.state.users.find((u) => u.id === id);
        if (user) user.role = 'Lead';
    };

    removeUser = (id: number): void => {
        const i = this.state.users.findIndex((u) => u.id === id);
        if (i !== -1) this.state.users.splice(i, 1);
    };

    template = (): Template => tpl`
        <p class="note">
            A keyed <code>repeat</code> whose rows are <em>child components</em>,
            each with <code>:name</code>/<code>:role</code> prop bindings. Adding,
            removing and promoting patch only the affected card.
        </p>
        <div class="bar"><button @click=${this.add}>Add user</button></div>
        <div class="list">
            ${repeat(
                this.state.users,
                (user) => tpl`<div class="row">
                    <user-card :name=${user.name} :role=${user.role} />
                    <button class="promote" @click=${() => this.promote(user.id)}>promote</button>
                    <button class="drop" @click=${() => this.removeUser(user.id)}>×</button>
                </div>`,
                (user) => user.id,
            )}
        </div>
    `;
}

