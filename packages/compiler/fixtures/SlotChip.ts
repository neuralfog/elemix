import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: inline-flex; }
    .chip {
        padding: 8px 14px;
        border-radius: 999px;
        font: 600 13px system-ui, sans-serif;
        color: #fff;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
    }
`;

// #component
export class SlotChip extends Component<{ label: string }> {
    // #styles
    styles = css;

    template = (): Template => tpl`<span class="chip">${this.props.label}</span>`;
}
