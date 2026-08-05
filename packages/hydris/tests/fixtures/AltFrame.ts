import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class AltFrame extends Component {
    override template = (): Template => tpl`
        <html lang="en">
            <head>
                <title>Alt Frame</title>
            </head>
            <body>
                <main id="alt"></main>
                <slot></slot>
            </body>
        </html>
    `;
}
