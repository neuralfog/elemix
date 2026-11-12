import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class ActionsDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Actions</title>
            </head>
            <body>
                <slot></slot>
            </body>
        </html>
    `;
}
