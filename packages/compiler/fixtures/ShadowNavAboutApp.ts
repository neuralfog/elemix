import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { ShadowNavDocument } from './ShadowNavDocument';
import './ShadowNavShell';

// #component
export class ShadowNavAboutApp extends Component {
    // #document
    document = ShadowNavDocument;

    template = (): Template => tpl`
        <shadow-nav-shell></shadow-nav-shell>
        <main id="page" data-page="about">
            <h1>About</h1>
        </main>
    `;
}
