import { Component, tpl } from '@neuralfog/elemix';
import '@neuralfog/elemix/navigation/NavLink';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class ScrollNavDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Scroll Nav</title>
            </head>
            <body>
                <nav class="nav">
                    <nav-link route="/scroll-nav-a">
                        <a id="to-a" href="/scroll-nav-a">A</a>
                    </nav-link>
                    <nav-link route="/scroll-nav-b">
                        <a id="to-b" href="/scroll-nav-b">B</a>
                    </nav-link>
                </nav>
                <slot></slot>
            </body>
        </html>
    `;
}
