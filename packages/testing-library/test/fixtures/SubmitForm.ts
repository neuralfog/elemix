import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class SubmitForm extends Component {
    // #state
    state = { submitted: 0 };

    onSubmit = (e: Event): void => {
        e.preventDefault();
        this.state.submitted++;
    };

    template = (): Template => tpl`
        <form class="form" @submit=${this.onSubmit}>
            <button class="go" type="submit">go</button>
        </form>
        <span class="count">${this.state.submitted}</span>
    `;
}
