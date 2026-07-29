import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: inline-block; }
    button {
        font: inherit;
        padding: 9px 18px;
        border: none;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
`;

// #component #form
export class SubmitButton extends Component {
    // #styles
    styles = css;

    submit = (): void => {
        this.internals.form?.requestSubmit();
    };

    template = (): Template =>
        tpl`<button type="button" @click=${this.submit}><slot></slot></button>`;
}

