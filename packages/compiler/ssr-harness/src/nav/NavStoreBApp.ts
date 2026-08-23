import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { StoreDocument } from './StoreDocument';
import { prefs } from './store';

// #component
export class NavStoreBApp extends Component {
    // #document
    document = StoreDocument;

    template = (): Template => tpl`
        <main id="page-b" data-count="${prefs.count}">
            <span id="count-b">${prefs.count}</span>
        </main>
    `;
}
