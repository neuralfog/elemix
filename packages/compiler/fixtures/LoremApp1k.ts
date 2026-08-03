import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './LoremParagraph';

const LOREM =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

// #component
export class LoremApp1k extends Component {
    // #state
    state = {
        items: Array.from({ length: 1000 }, (_, i) => i),
    };

    template = (): Template => tpl`
        <div class="lorem">
            ${repeat(
                this.state.items,
                (i) => tpl`<lorem-paragraph :index=${i} :text=${LOREM} />`,
                (i) => i,
            )}
        </div>
    `;
}
