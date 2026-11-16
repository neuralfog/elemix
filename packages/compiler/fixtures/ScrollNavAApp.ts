import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { ScrollNavDocument } from './ScrollNavDocument';

// #component
export class ScrollNavAApp extends Component {
    // #document
    document = ScrollNavDocument;

    // #styles
    styles = ':host{display:block}';

    template = (): Template => tpl`
        <main id="page" data-page="a">
            <h1>Page A</h1>
            <div id="spacer-a" style="height: 3000px"></div>
            <div id="bottom-a">bottom a</div>
        </main>
    `;
}
