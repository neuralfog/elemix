import { render } from '@neuralfog/elemix-renderer';
import type { Component } from './Component';
import type { RenderTriggerType } from '../types';
import { activeRenderers } from '../renderers';

export class Renderer {
    private locked = false;
    private scheduledRenderTriggers = new Set<RenderTriggerType>();

    constructor(private component: Component) {}

    public schedule(
        renderTrigger?: RenderTriggerType,
        isConnectedCallback = false,
    ): void {
        if (this.component.template) {
            if (renderTrigger) this.scheduledRenderTriggers.add(renderTrigger);
            if (!this.locked) {
                this.locked = true;
                activeRenderers.add(this);
                setTimeout(() => {
                    this.render(Array.from(this.scheduledRenderTriggers));
                    this.scheduledRenderTriggers.clear();
                    this.locked = false;
                    activeRenderers.delete(this);
                    if (isConnectedCallback) this.component.onMount?.();
                }, 0);
            }
        }
    }

    private render(renderTriggers: RenderTriggerType[]): void {
        if (this.component.template) {
            render(
                this.component.template(),
                this.component.root as HTMLElement,
            );
            this.component.onRender?.(renderTriggers);
        }
    }
}
