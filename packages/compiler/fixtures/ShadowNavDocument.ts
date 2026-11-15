import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Data = { title?: string; page?: string };

// #document
export class ShadowNavDocument extends Component<unknown, Data> {
    template = (): Template => tpl`
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${this.viewData?.title ?? 'Nav'}</title>
                <meta name="page" content="${this.viewData?.page ?? ''}" />
                <style id="nav-style">.nav{display:flex;gap:8px}</style>
                <script
                    id="head-once"
                >window.__headRuns=(window.__headRuns||0)+1;</script>
                ${
                    this.viewData?.page === 'about'
                        ? tpl`
                            <meta name="about-only" content="yes" />
                            <style id="about-style">.about{color:red}</style>
                            <script>window.__aboutScript=(window.__aboutScript||0)+1;</script>
                        `
                        : ''
                }
            </head>
            <body>
                <slot></slot>
            </body>
        </html>
    `;
}
