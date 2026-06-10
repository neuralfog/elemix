import { Component, defineComponent } from '@neuralfog/elemix';
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

export class SubmitButton extends Component {
    static styles = [css];

    static formAssociated = true;
    declare internals: ElementInternals;

    submit = (): void => {
        this.internals.form?.requestSubmit();
    };

    template = (): Template =>
        tpl`<button type="button" @click=${this.submit}><slot></slot></button>`;
}

defineComponent('submit-button', SubmitButton);
