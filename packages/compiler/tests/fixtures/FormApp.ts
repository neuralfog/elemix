import { Component, defineComponent, state } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './RatingInput';
import './SubmitButton';

type State = {
    result: string;
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 440px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .note {
        margin: 0 0 20px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
        background: #f1f5f9;
        border-left: 3px solid var(--accent);
        border-radius: 8px;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        background: #e2e8f0;
        padding: 1px 5px;
        border-radius: 4px;
    }
    form { display: flex; flex-direction: column; gap: 14px; }
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: #475569;
    }
    input {
        font: inherit;
        font-size: 15px;
        padding: 9px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        outline: none;
    }
    input:focus { border-color: var(--accent); }
    .out {
        margin: 18px 0 0;
        padding: 12px 14px;
        font-size: 13px;
        color: #0f172a;
        background: #f1f5f9;
        border-radius: 8px;
        white-space: pre-wrap;
    }
`;

export class FormApp extends Component {
    static styles = [css];

    state = state<State>({ result: '' });

    submit = (e: Event): void => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        this.state.result = JSON.stringify(Object.fromEntries(data), null, 2);
    };

    template = (): Template => tpl`
        <p class="note">
            With <code>static formAssociated = true</code>, Elemix attaches
            <code>ElementInternals</code>. Both the star rating and the submit
            button are custom elements that take part in the native form.
        </p>
        <form @submit=${this.submit}>
            <label>
                Name
                <input name="name" type="text" value="Ada" />
            </label>
            <label>
                Rating
                <rating-input name="rating" />
            </label>
            <submit-button>Submit</submit-button>
        </form>
        ${
            this.state.result
                ? tpl`<pre class="out">${this.state.result}</pre>`
                : ''
        }
    `;
}

defineComponent('form-app', FormApp);
