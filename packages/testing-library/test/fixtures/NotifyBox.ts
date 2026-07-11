import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class NotifyBox extends Component {
    // #state
    state = { last: '' };

    onNotify = (e: Event): void => {
        this.state.last = (e as CustomEvent<string>).detail;
    };

    template = (): Template => tpl`
        <div class="box" @notify=${this.onNotify}>
            <span class="last">${this.state.last}</span>
        </div>
    `;
}
