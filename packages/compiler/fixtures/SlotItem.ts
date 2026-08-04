import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: block; }
    .item {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .item h3 {
        margin: 0;
        font: 700 15px system-ui, sans-serif;
        color: #1e293b;
    }
`;

// #component
export class SlotItem extends Component<{ title: string }> {
    // #styles
    styles = css;

    template = (): Template => tpl`
        <div class="item">
            <h3>${this.props.title}</h3>
            <slot></slot>
        </div>
    `;
}
