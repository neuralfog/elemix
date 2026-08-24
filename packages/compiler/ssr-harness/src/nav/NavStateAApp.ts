import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { counter } from './counter';
import { StateDocument } from './StateDocument';

// #component
export class NavStateAApp extends Component {
    // #document
    document = StateDocument;

    inc = (): void => {
        counter.count++;
    };

    template = (): Template => tpl`
        <main id="page-a" data-count="${counter.count}">
            <span id="state-a">${counter.count}</span>
            <button id="inc-a" @click=${this.inc}>inc</button>
        </main>
    `;
}
