import { type HtmlTemplate, render } from '@neuralfog/elemix-renderer';
import type { Component } from './Component';
import type { RenderTriggerType } from '../types';
import { activeRenderers, renderTracking } from '../renderers';

export class Renderer {
    private locked = false;
    private scheduledRenderTriggers = new Set<RenderTriggerType>();

    constructor(private component: Component) {}

    public schedule(
        renderTrigger?: RenderTriggerType,
        isConnectedCallback = false,
    ): void {
        if (this.component.template()) {
            if (renderTrigger) this.scheduledRenderTriggers.add(renderTrigger);
            if (!this.locked) {
                this.locked = true;
                activeRenderers.add(this);
                setTimeout(() => {
                    this.render(Array.from(this.scheduledRenderTriggers));
                    this.scheduledRenderTriggers.clear();
                    this.locked = false;
                    activeRenderers.delete(this);
                    if (isConnectedCallback) {
                        this.component.onMount();
                        this.component.removeAttribute('data-cloak');
                    }
                }, 0);
            }
        }
    }

    private render(renderTriggers: RenderTriggerType[]): void {
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
        try {
            render(
                this.component.template() as HtmlTemplate,
                this.component.root as HTMLElement,
            );
        } finally {
            renderTracking.active = prev;
        }
        this.component.onRender(renderTriggers);
    }
}
