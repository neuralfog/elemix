import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Data = { title?: string };

// #document
export class DocFrame extends Component<unknown, Data> {
    override template = (): Template => tpl`
        <html lang="en">
            <head>
                <title>${this.viewData?.title ?? 'Doc Frame'}</title>
            </head>
            <body>
                <header id="chrome">frame</header>
                <slot></slot>
            </body>
        </html>
    `;
}
