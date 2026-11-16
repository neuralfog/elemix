import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { ScrollNavDocument } from './ScrollNavDocument';

// #component
export class ScrollNavBApp extends Component {
    // #document
    document = ScrollNavDocument;

    // #styles
    styles = ':host{display:block}';

    template = (): Template => tpl`
        <main id="page" data-page="b">
            <h1>Page B</h1>
            <div id="spacer-b" style="height: 3000px"></div>
            <div id="bottom-b">bottom b</div>
        </main>
    `;
}
