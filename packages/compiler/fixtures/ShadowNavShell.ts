import { Component, tpl } from '@neuralfog/elemix';
import '@neuralfog/elemix/navigation/NavLink';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class ShadowNavShell extends Component {
    template = (): Template => tpl`
        <nav class="nav">
            <nav-link route="/shadow-nav-home">
                <a id="to-home" href="/shadow-nav-home">Home</a>
            </nav-link>
            <nav-link route="/shadow-nav-about">
                <a id="to-about" href="/shadow-nav-about">About</a>
            </nav-link>
            <a id="hard-link" href="/shadow-nav-home">Hard</a>
            <nav-link route="/shadow-nav-about">
                <button id="disabled-btn" aria-disabled="true">Off</button>
            </nav-link>
        </nav>
    `;
}
