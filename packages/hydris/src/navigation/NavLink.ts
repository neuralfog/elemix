import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import { navigate } from './navigate';

// #component
export class NavLink extends Component {
    // #styles
    styles = ':host{display:contents}';

    private onClick = (event: MouseEvent): void => {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        )
            return;

        const route = this.getAttribute('route');
        if (route === null || this.hasAttribute('disabled')) return;

        for (const el of event.composedPath()) {
            if (el === this) break;
            if (
                el instanceof HTMLElement &&
                (el.hasAttribute('disabled') ||
                    el.getAttribute('aria-disabled') === 'true')
            )
                return;
        }

        event.preventDefault();
        navigate(route);
    };

    // #mount
    bind(): void {
        this.addEventListener('click', this.onClick);
    }

    // #dispose
    unbind(): void {
        this.removeEventListener('click', this.onClick);
    }

    override template = (): Template => tpl`<slot></slot>`;
}
