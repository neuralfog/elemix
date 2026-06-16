import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

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
    .value {
        margin-bottom: 18px;
        font-size: 56px;
        font-weight: 800;
        line-height: 1;
        color: var(--accent);
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

// #component
export class RenderApp extends Component {
    // #styles
    styles = css;

    count = 0;

    silent = (): void => {
        this.count++;
    };

    withRender = (): void => {
        this.count++;
        this.render();
    };

    template = (): Template => tpl`
        <p class="note">
            <code>count</code> here is a plain field, not reactive state, so
            mutating it does not re-render. "Increment (silent)" changes the
            value behind the scenes; "Increment + render()" calls
            <code>this.render()</code> to manually flush it to the DOM — watch the
            silent increments catch up. This is ideal when you want full manual
            control over rendering, driving updates yourself without reactive
            state getting in the way.
        </p>
        <div class="value">${this.count}</div>
        <div class="buttons">
            <button class="ghost" @click=${this.silent}>Increment (silent)</button>
            <button @click=${this.withRender}>Increment + render()</button>
        </div>
    `;
}

