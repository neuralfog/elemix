import { render } from '../renderer/render';
import type { HtmlTemplate } from '../renderer/types';
import type { Component } from './Component';
import { activeRenderers, renderTracking } from '../renderers';

export class Renderer {
    private locked = false;
    private pendingOnMount = false;

    constructor(private component: Component) {}

    public schedule(isConnectedCallback = false): void {
        if (isConnectedCallback) this.pendingOnMount = true;

        if (this.locked) return;

        const prev = renderTracking.active;
        renderTracking.active = null;
        const hasTemplate = this.component.template();
        renderTracking.active = prev;
        if (!hasTemplate) return;

        this.locked = true;
        activeRenderers.add(this);
        queueMicrotask(() => {
            this.render();
            this.locked = false;
            activeRenderers.delete(this);
            if (this.pendingOnMount) {
                this.pendingOnMount = false;
                this.component.onMount();
                this.component.removeAttribute('data-cloak');
            }
        });
    }

    private render(): void {
        for (const sig of this.component.tracked) {
            sig.unsubscribe(this.component);
        }
        this.component.tracked.clear();
        this.component.deps.clear();

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
