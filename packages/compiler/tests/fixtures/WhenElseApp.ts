import { Component, tpl } from '@neuralfog/elemix';
import { when } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type State = { loggedIn: boolean };

// #component
export class WhenElseApp extends Component {
    // #state
    state: State = { loggedIn: false };

    toggle = (): void => {
        this.state.loggedIn = !this.state.loggedIn;
    };

    template(): Template {
        return tpl`
            <div class="stage">
                ${when(
                    this.state.loggedIn,
                    () => tpl`<div class="card ready">✓ Welcome back</div>`,
                    () => tpl`<div class="card idle">Please log in</div>`,
                )}
            </div>
            <button class="toggle" @click=${this.toggle}>toggle</button>
        `;
    }
}
