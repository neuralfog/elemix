import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { StoreDocument } from './StoreDocument';
import { prefs } from './store';

// #component
export class NavStoreAApp extends Component {
    // #document
    document = StoreDocument;

    inc = (): void => {
        prefs.count++;
    };

    bloat = (): void => {
        prefs.big = 'x'.repeat(5000);
    };

    template = (): Template => tpl`
        <main id="page-a" data-count="${prefs.count}">
            <span id="count-a">${prefs.count}</span>
            <button id="inc" @click=${this.inc}>inc</button>
            <button id="bloat" @click=${this.bloat}>bloat</button>
        </main>
    `;
}
