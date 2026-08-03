import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './LoremNested';

const LOREM =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const css = `
    :host { display: block; }
    .lorem {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 24px;
        max-width: 720px;
        margin: 0 auto;
        background: #f1f5f9;
    }
`;

const nest = (depth: number): Template => {
    let inner: Template = tpl``;
    for (let i = depth - 1; i >= 0; i--) {
        inner = tpl`<lorem-nested :index=${i} :text=${LOREM}>${inner}</lorem-nested>`;
    }
    return inner;
};

// #component
export class LoremNested10k extends Component {
    // #styles
    styles = css;

    template = (): Template => tpl`<div class="lorem">${nest(10000)}</div>`;
}
