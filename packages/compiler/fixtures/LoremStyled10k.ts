import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './LoremParagraphStyled';

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

// #component
export class LoremStyled10k extends Component {
    // #styles
    styles = css;

    // #state
    state = {
        items: Array.from({ length: 10000 }, (_, i) => i),
    };

    template = (): Template => tpl`
        <div class="lorem">
            ${repeat(
                this.state.items,
                (i) => tpl`<lorem-paragraph-styled :index=${i} :text=${LOREM} />`,
                (i) => i,
            )}
        </div>
    `;
}
