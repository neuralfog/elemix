import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: block; }
    .panel {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 16px;
        border-radius: 12px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
    }
`;

// #component
export class SlotPanel extends Component {
    // #styles
    styles = css;

    template = (): Template => tpl`<div class="panel"><slot></slot></div>`;
}
