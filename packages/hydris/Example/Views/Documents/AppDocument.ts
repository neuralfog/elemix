import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class AppDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Hydris Example</title>
            </head>
            <body>
                <header id="chrome">hydris</header>
                <slot></slot>
            </body>
        </html>
    `;
}
