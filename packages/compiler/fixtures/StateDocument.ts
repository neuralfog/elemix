import { Component, tpl } from '@neuralfog/elemix';
import '@neuralfog/elemix-ssr/navigation/NavLink';
import type { Template } from '@neuralfog/elemix/types';

// #document
export class StateDocument extends Component {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>State</title>
            </head>
            <body>
                <nav class="nav">
                    <nav-link route="/nav-state-a"
                        ><a id="to-state-a" href="/nav-state-a">A</a></nav-link
                    >
                    <nav-link route="/nav-state-b"
                        ><a id="to-state-b" href="/nav-state-b">B</a></nav-link
                    >
                </nav>
                <slot></slot>
            </body>
        </html>
    `;
}
