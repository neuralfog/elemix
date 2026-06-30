import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = { caught: number };

// #component
export class CustomEventApp extends Component {
    // #state
    state: State = { caught: 0 };

    fire = (e: Event): void => {
        (e.currentTarget as Element).dispatchEvent(
            new CustomEvent('ping', { detail: 1 }),
        );
    };

    onPing = (e: Event): void => {
        this.state.caught += (e as CustomEvent<number>).detail;
    };

    template(): Template {
        return tpl`
            <button class="fire" @click=${this.fire} @ping=${this.onPing}>fire</button>
            <span class="caught">${this.state.caught}</span>
        `;
    }
}
