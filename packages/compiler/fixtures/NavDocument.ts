import { Component, tpl } from '@neuralfog/elemix';
import '@neuralfog/elemix-ssr/navigation/NavLink';
import type { Template } from '@neuralfog/elemix/types';

type Data = { title?: string; page?: string };

// #document
export class NavDocument extends Component<unknown, Data> {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${this.viewData?.title ?? 'Nav'}</title>
                <meta name="page" content="${this.viewData?.page ?? ''}" />
                <style id="nav-style">.nav{display:flex;gap:8px}</style>
                <script id="head-once">window.__headRuns=(window.__headRuns||0)+1;</script>
                ${
                    this.viewData?.page === 'about'
                        ? tpl`<meta name="about-only" content="yes" /><style id="about-style">.about{color:red}</style><script>window.__aboutScript=(window.__aboutScript||0)+1;</script>`
                        : ''
                }
            </head>
            <body>
                <nav class="nav">
                    <nav-link route="/nav-home-app"
                        ><a id="to-home" href="/nav-home-app">Home</a></nav-link
                    >
                    <nav-link route="/nav-about-app"
                        ><a id="to-about" href="/nav-about-app">About</a></nav-link
                    >
                    <a id="hard-link" href="/nav-home-app">Hard</a>
                    <nav-link route="/nav-about-app"
                        ><button id="disabled-btn" aria-disabled="true">
                            Off</button
                        ></nav-link
                    >
                </nav>
                <slot></slot>
            </body>
        </html>
    `;
}
