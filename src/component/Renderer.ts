import { render } from '../renderer/render';
import type { HtmlTemplate } from '../renderer/types';
import type { Component } from './Component';
import { activeRenderers, renderTracking } from '../renderers';

export class Renderer {
    private locked = false;
    private pendingOnMount = false;

    constructor(private component: Component) {}

    public schedule(isConnectedCallback = false): void {
        // Persist on the Renderer so a connectedCallback's render(true)
        // still triggers onMount + data-cloak removal even when a prior
        // schedule (e.g. a beforeMount state mutation) already locked us.
        if (isConnectedCallback) this.pendingOnMount = true;

        const prev = renderTracking.active;
        renderTracking.active = null;
        const hasTemplate = this.component.template();
        if (!hasTemplate) return;

        renderTracking.active = prev;

        if (!this.locked) {
            this.locked = true;
            activeRenderers.add(this);
            setTimeout(() => {
                this.render();
                this.locked = false;
                activeRenderers.delete(this);
                if (this.pendingOnMount) {
                    this.pendingOnMount = false;
                    this.component.onMount();
                    this.component.removeAttribute('data-cloak');
                }
            }, 0);
        }
    }

    private render(): void {
        // Drop subscriptions captured during the previous render so we don't
        // hold stale dependencies for signals no longer read.
        for (const sig of this.component.tracked) {
            sig.unsubscribe(this.component);
        }
        this.component.tracked.clear();

        // Mark this component as the active reader so Reactive proxies
        // subscribe it automatically when their values are read.
        const prev = renderTracking.active;
        renderTracking.active = this.component;

        const dirty = render(
            this.component.template() as HtmlTemplate,
            this.component.root as HTMLElement,
        );

        renderTracking.active = prev;

        if (dirty) this.component.onMutation();
    }
}
