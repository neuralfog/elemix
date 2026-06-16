import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    value: number;
};

const css = `
    :host { display: inline-block; }
    .stars { display: flex; gap: 2px; }
    button.star {
        padding: 0;
        font-size: 24px;
        line-height: 1;
        color: #cbd5e1;
        background: none;
        border: none;
        cursor: pointer;
        transition: color 0.1s ease;
    }
    button.star.on { color: #f59e0b; }
    button.star:hover { color: #fbbf24; }
`;

// #component #form
export class RatingInput extends Component {
    // #styles
    styles = css;

    // #state
    state: State = { value: 0 };

    beforeMount(): void {
        this.internals.setFormValue(String(this.state.value));
    }

    set = (n: number): void => {
        this.state.value = n;
        this.internals.setFormValue(String(n));
    };

    template = (): Template => tpl`<div class="stars">
        ${repeat(
            [1, 2, 3, 4, 5],
            (n) => tpl`<button
                type="button"
                class=${{ star: true, on: n <= this.state.value }}
                @click=${() => this.set(n)}
            >★</button>`,
            (n) => String(n),
        )}
    </div>`;
}

