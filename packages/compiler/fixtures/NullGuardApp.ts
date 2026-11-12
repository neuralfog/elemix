import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Row = { id: string };

// #component
export class NullGuardApp extends Component {
    // #state
    model: { row: Row | null } = { row: { id: 'first' } };

    toggle = (): void => {
        this.model.row = this.model.row ? null : { id: 'again' };
    };

    template = (): Template => tpl`
        <main>
            <button id="toggle" @click=${this.toggle}>toggle</button>
            ${
                this.model.row
                    ? tpl`<p class="val">${this.model.row.id}</p>`
                    : tpl`<p class="empty">empty</p>`
            }
        </main>
    `;
}
