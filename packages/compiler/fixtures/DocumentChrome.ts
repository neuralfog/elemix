import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: block; }
    .bar {
        padding: 8px 16px;
        font: 700 14px system-ui, sans-serif;
        color: #fff;
        background: #1e293b;
    }
`;

// #component
export class DocumentChrome extends Component {
    // #styles
    styles = css;

    template = (): Template => tpl`<div class="bar">Harness</div>`;
}
