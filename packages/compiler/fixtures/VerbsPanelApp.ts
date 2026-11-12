import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class VerbsPanelApp extends Component {
    // #state
    state = { open: false };

    cell = (label: string): Template | string =>
        this.state.open ? tpl`<pre class="cell">${label}</pre>` : '';

    row(label: string): Template | string {
        return this.state.open ? tpl`<pre class="row">${label}</pre>` : '';
    }

    toggle = (): void => {
        this.state.open = !this.state.open;
    };

    template = (): Template => tpl`
        <main>
            <h1>Panel</h1>
            <button class="toggle" @click=${this.toggle}>toggle</button>
            ${this.state.open ? tpl`<p class="busy">busy</p>` : ''}
            ${this.cell('POST')}
            ${this.row('GET')}
            <h2>Verbs</h2>
            <p>Status (${this.state.open ? 'open' : 'none'}).</p>
            <button>DO</button>
            ${this.cell('PUT')}
            ${this.row('PATCH')}
        </main>
    `;
}
