import { Component, defineComponent, state } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    loggedIn: boolean;
    showTip: boolean;
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
    .panel { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
    .card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
        border-radius: 12px;
    }
    .card strong { font-size: 16px; }
    .card span { font-size: 13px; opacity: 0.9; }
    .card.welcome {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
    }
    .card.guest { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .tip {
        padding: 10px 12px;
        font-size: 13px;
        color: #92400e;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 8px;
    }
    .buttons { display: flex; gap: 10px; }
    button {
        font: inherit;
        padding: 9px 16px;
        border: none;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    button.ghost { background: #e2e8f0; color: #475569; }
    button.ghost:hover { background: #cbd5e1; }
`;

export class ConditionalApp extends Component {
    static styles = [css];

    state = state<State>({
        loggedIn: false,
        showTip: true,
    });

    toggleLogin = (): void => {
        this.state.loggedIn = !this.state.loggedIn;
    };

    toggleTip = (): void => {
        this.state.showTip = !this.state.showTip;
    };

    template = (): Template => tpl`
        <p class="note">
            Conditionals are just JavaScript in the template. A ternary swaps
            between two templates; a ternary with an empty branch
            (<code>: ''</code>) renders nothing.
        </p>
        <div class="panel">
            ${
                this.state.loggedIn
                    ? tpl`<div class="card welcome">
                          <strong>Welcome back! 🎉</strong>
                          <span>You are signed in.</span>
                      </div>`
                    : tpl`<div class="card guest">
                          <strong>You are signed out</strong>
                          <span>Sign in to see your dashboard.</span>
                      </div>`
            }
            ${
                this.state.showTip
                    ? tpl`<div class="tip">💡 Toggle the buttons to watch each branch mount and unmount.</div>`
                    : ''
            }
        </div>
        <div class="buttons">
            <button @click=${this.toggleLogin}>
                ${this.state.loggedIn ? 'Sign out' : 'Sign in'}
            </button>
            <button class="ghost" @click=${this.toggleTip}>
                ${this.state.showTip ? 'Hide tip' : 'Show tip'}
            </button>
        </div>
    `;
}

defineComponent('conditional-app', ConditionalApp);
