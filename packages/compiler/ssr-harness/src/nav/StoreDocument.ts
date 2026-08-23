import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import '@neuralfog/hydris/navigation';

// #document
export class StoreDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Store</title>
            </head>
            <body>
                <nav class="nav">
                    <nav-link route="/nav-store-a"
                        ><a id="to-store-a" href="/nav-store-a">A</a></nav-link
                    >
                    <nav-link route="/nav-store-b"
                        ><a id="to-store-b" href="/nav-store-b">B</a></nav-link
                    >
                </nav>
                <slot></slot>
            </body>
        </html>
    `;
}
