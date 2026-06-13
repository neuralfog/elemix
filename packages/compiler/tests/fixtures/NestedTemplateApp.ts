import { Component, defineComponent, state, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    title: string;
    tag: string;
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
        margin: 0 0 18px;
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
    h2 { margin: 0 0 12px; font-size: 20px; }
    .chips { margin-bottom: 16px; font-size: 14px; color: #475569; }
    .chip {
        display: inline-block;
        padding: 2px 10px;
        font-weight: 600;
        color: white;
        background: var(--accent);
        border-radius: 999px;
    }
    button {
        font: inherit;
        font-size: 13px;
        padding: 6px 12px;
        margin-right: 8px;
        border: none;
        border-radius: 8px;
        background: #e2e8f0;
        color: #1e293b;
        cursor: pointer;
    }
    button:hover { background: #cbd5e1; }
`;

export class NestedTemplateApp extends Component {
    static styles = [css];

    state = state<State>({
        title: 'Dashboard',
        tag: 'new',
    });

    changeTitle = (): void => {
        this.state.title =
            this.state.title === 'Dashboard' ? 'Reports' : 'Dashboard';
    };

    changeTag = (): void => {
        this.state.tag = this.state.tag === 'new' ? 'hot' : 'new';
    };

    template = (): Template => {
        const header = tpl`<h2>${this.state.title}</h2>`;
        const chip = tpl`<span class="chip">${this.state.tag}</span>`;
        return tpl`
            <p class="note">
                A nested template can be assigned to a variable and embedded in
                another. Each embed builds a fresh, independently-reactive fragment
                — the same <code>chip</code> template is reused twice and both
                update from one shared cell.
            </p>
            <section>
                ${header}
                <div class="chips">${chip} and again ${chip}</div>
                <button @click=${this.changeTitle}>change title</button>
                <button @click=${this.changeTag}>change tag</button>
            </section>
        `;
    };
}

defineComponent('nested-template-app', NestedTemplateApp);
