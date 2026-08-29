import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import '@neuralfog/elemix-ssr/navigation/NavLink';
import { AppDocument } from '#views/Documents/AppDocument';

// #component
export class AboutPage extends Component {
    // #document
    document = AppDocument;

    template = (): Template => tpl`
        <main id="page" data-page="about">
            <h1>About</h1>
            <nav-link route="/test-render"><a href="/test-render">Back home</a></nav-link>
        </main>
    `;
}
