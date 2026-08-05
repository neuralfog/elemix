import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './DocumentChrome';

type Data = { title?: string };

// #document
export class DocumentFrame extends Component<unknown, Data> {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${this.viewData?.title ?? 'Harness Document'}</title>
            </head>
            <body>
                <document-chrome id="chrome"></document-chrome>
                <slot></slot>
            </body>
        </html>
    `;
}
