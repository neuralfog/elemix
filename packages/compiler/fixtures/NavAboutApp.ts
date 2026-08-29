import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { NavDocument } from './NavDocument';

// #component
export class NavAboutApp extends Component {
    // #document
    document = NavDocument;

    template = (): Template => tpl`
        <main id="page" data-page="about">
            <h1>About</h1>
        </main>
    `;
}
