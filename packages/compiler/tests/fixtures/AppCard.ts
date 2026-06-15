import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: block; margin-bottom: 14px; font-family: system-ui, sans-serif; }
    .card {
        overflow: hidden;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    .header {
        padding: 10px 16px;
        font-weight: 700;
        color: white;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    .body { padding: 16px; color: #1e293b; }
    .body p { margin: 0; }
    .footer {
        padding: 8px 16px;
        font-size: 12px;
        color: #64748b;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
    }
`;

`#component #styles ${css}`
export class AppCard extends Component {

    template = (): Template => tpl`<div class="card">
        ${
            this.hasSlot('header')
                ? tpl`<div class="header"><slot name="header"></slot></div>`
                : ''
        }
        <div class="body"><slot></slot></div>
        ${
            this.hasSlot('footer')
                ? tpl`<div class="footer"><slot name="footer"></slot></div>`
                : ''
        }
    </div>`;
}

