import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    label?: string;
};

const css = `
    :host { display: inline-block; font-family: system-ui, sans-serif; }
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #6366f1;
        background: #eef2ff;
        color: #1e293b;
        cursor: pointer;
    }
`;

// #component
export class IconButton extends Component<Props> {
    // #styles
    styles = css;

    template = (): Template =>
        tpl`<button>${this.props.label ?? ''}<slot></slot></button>`;
}

type State = {
    label: string;
};

const appCss = `
    :host { display: flex; gap: 12px; font-family: system-ui, sans-serif; }
`;

// #component
export class IconButtonApp extends Component {
    // #styles
    styles = appCss;

    // #state
    state: State = { label: '' };

    setLabel = (): void => {
        this.state.label = 'Saved';
    };

    clearLabel = (): void => {
        this.state.label = '';
    };

    template = (): Template => tpl`
        <icon-button :label=${this.state.label}>
            <span class="pip">★</span>
        </icon-button>
        <button class="set" @click=${this.setLabel}>set</button>
        <button class="clear" @click=${this.clearLabel}>clear</button>
    `;
}
