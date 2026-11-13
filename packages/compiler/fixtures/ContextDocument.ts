import { Component, tpl } from '@neuralfog/elemix';
import '@neuralfog/elemix/navigation/NavLink';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class ContextDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Context</title>
            </head>
            <body>
                <nav>
                    <nav-link route="/context/alpha?q=one">
                        <a id="to-alpha" href="/context/alpha?q=one">Alpha</a>
                    </nav-link>
                    <nav-link route="/context/beta?q=two">
                        <a id="to-beta" href="/context/beta?q=two">Beta</a>
                    </nav-link>
                </nav>
                <slot></slot>
            </body>
        </html>
    `;
}
