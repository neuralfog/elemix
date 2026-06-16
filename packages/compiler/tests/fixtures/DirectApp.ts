import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Toggle = 'active' | 'rounded' | 'large' | 'disabled';

type State = {
    active: boolean;
    rounded: boolean;
    large: boolean;
    disabled: boolean;
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
    .box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        height: 80px;
        margin-bottom: 14px;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        background: #e2e8f0;
        transition: all 0.2s ease;
    }
    .box.active { background: var(--accent); color: white; }
    .box.rounded { border-radius: 18px; }
    .box.large { width: 210px; height: 110px; font-size: 16px; }
    .toggles { display: flex; gap: 8px; margin-bottom: 22px; }
    .toggles button {
        font: inherit;
        font-size: 13px;
        padding: 7px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: white;
        color: #475569;
        cursor: pointer;
    }
    .toggles button:hover { border-color: var(--accent); color: var(--accent); }
    .prop-demo {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 14px;
        color: #475569;
    }
    .action {
        font: inherit;
        padding: 9px 18px;
        border: none;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    .action:hover:not(:disabled) { background: #4f46e5; }
    .action:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// #component
export class DirectApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        active: true,
        rounded: false,
        large: false,
        disabled: false,
    };

    toggle = (key: Toggle): void => {
        this.state[key] = !this.state[key];
    };

    template = (): Template => tpl`
        <p class="note">
            Everything in a template is an attribute. A bare attribute binding
            sets an attribute (booleans toggle their presence); a class binding
            toggles classes from an object. Live DOM properties are set
            imperatively via a ref, never from the template.
        </p>
        <div
            class=${{
                box: true,
                active: this.state.active,
                rounded: this.state.rounded,
                large: this.state.large,
            }}
        >
            class
        </div>
        <div class="toggles">
            <button @click=${() => this.toggle('active')}>active</button>
            <button @click=${() => this.toggle('rounded')}>rounded</button>
            <button @click=${() => this.toggle('large')}>large</button>
        </div>
        <label class="prop-demo">
            <input
                type="checkbox"
                checked=${this.state.disabled}
                @change=${() => this.toggle('disabled')}
            />
            Disable the button (<code>disabled</code>)
        </label>
        <button class="action" disabled=${this.state.disabled}>Action</button>
    `;
}

