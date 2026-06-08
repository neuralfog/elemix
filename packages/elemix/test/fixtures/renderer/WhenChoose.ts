import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { state } from '../../../src/State';
import { when, choose } from '../../../src/renderer/directives';

type Role = 'admin' | 'editor' | 'guest';

export class WhenChoose extends Component {
    state = state<{ open: boolean; role: Role }>({
        open: true,
        role: 'admin',
    });

    template = (): Template => html`
        <div class="when">
            ${when(
                this.state.open,
                () => html`<p class="open">open</p>`,
                () => html`<p class="closed">closed</p>`,
            )}
        </div>
        <div class="bare">
            ${when(this.state.open, () => html`<p class="only">only</p>`)}
        </div>
        <div class="choose">
            ${choose([
                [
                    this.state.role === 'admin',
                    () => html`<p class="role">Admin</p>`,
                ],
                [
                    this.state.role === 'editor',
                    () => html`<p class="role">Editor</p>`,
                ],
                [true, () => html`<p class="role">Guest</p>`],
            ])}
        </div>
    `;
}

defineComponent('when-choose', WhenChoose);
