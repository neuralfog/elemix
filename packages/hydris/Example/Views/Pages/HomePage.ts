import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import '@neuralfog/elemix-ssr/navigation/NavLink';
import css from '#views/Pages/HomePage.scss?inline';
import '#views/Pages/UserCard';
import { AppDocument } from '#views/Documents/AppDocument';
import { prefs } from '#views/Stores/prefs';

type User = { id: number; name: string; role: string };

type State = {
    users: User[];
};

type HomeData = {
    title: string;
};

const NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara'];

// #component
export class HomePage extends Component<unknown, HomeData> {
    // #document
    document = AppDocument;

    // #styles
    styles = css;

    // #state
    state: State = {
        users: Array.from({ length: 40 }, (_, i) => ({
            id: i + 1,
            name: NAMES[i % NAMES.length],
            role: 'Engineer',
        })),
    };

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

    toggleTheme = (): void => {
        prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
    };

    template = (): Template => tpl`
        <h1 class="title">${this.viewData.title}</h1>
        <p id="theme">theme: ${prefs.theme}</p>
        <div class="bar">
            <button @click=${this.add}>Add user</button>
            <button id="toggle-theme" @click=${this.toggleTheme}>toggle theme</button>
            <nav-link route="/about"><a href="/about">About</a></nav-link>
        </div>
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
