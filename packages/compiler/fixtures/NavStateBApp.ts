import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { counter } from './counter';
import { StateDocument } from './StateDocument';

// #component
export class NavStateBApp extends Component {
    // #document
    document = StateDocument;

    template = (): Template => tpl`
        <main id="page-b" data-count="${counter.count}">
            <span id="state-b">${counter.count}</span>
        </main>
    `;
}
