import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './AppCard';

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
`;

// #component
export class SlotApp extends Component {
    // #styles
    styles = css;

    template = (): Template => tpl`
        <p class="note">
            Slots project light-DOM children into a component's shadow DOM.
            <code>hasSlot('footer')</code> lets the card render an area only when
            matching content is provided.
        </p>
        <app-card>
            <span slot="header">⭐ Featured</span>
            <p>Default-slot content lives in the card body.</p>
            <span slot="footer">Updated just now</span>
        </app-card>
        <app-card>
            <p>This card has only body content — no header or footer slot.</p>
        </app-card>
    `;
}

