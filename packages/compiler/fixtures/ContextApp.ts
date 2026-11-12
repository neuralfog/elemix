import { Component, csrf, param, query, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { ContextDocument } from './ContextDocument';

// #component
export class ContextApp extends Component {
    // #document
    document = ContextDocument;

    template = (): Template => tpl`
        <main>
            <p class="id">${param('id') ?? '-'}</p>
            <p class="q">${query('q') ?? '-'}</p>
            <p class="csrf">${csrf()}</p>
        </main>
    `;
}
