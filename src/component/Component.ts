import { RenderTrigger, type RenderTriggerType, type Template } from '../types';
import { Renderer } from './Renderer';
import { LocalState } from './LocalState';
import { Props } from './Props';
import { Styles } from './Styles';
import { activeRenderers } from '../renderers';
export class Component<ComponentProps = unknown> extends HTMLElement {
    private $props = new Props<ComponentProps>(this);
    private $renderer = new Renderer(this);
    private $localState = new LocalState(this);
    private $styles = new Styles(this);
    private $controlStyles?: CSSStyleSheet[];

    public get root(): HTMLElement | ShadowRoot | null {
        return this.shadowRoot;
    }

    public get props(): ComponentProps {
        return this.$props.data;
    }

    public get styles(): Styles {
        return this.$styles;
    }

    public get controlStyles(): CSSStyleSheet[] {
        return this.$controlStyles || [];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.setAttribute('data-cloak', '');
    }

    connectedCallback(): void {
        this.beforeMount();
        this.$styles.initialize();
        this.$props.initialize();
        this.$localState.initialize();
        this.render(RenderTrigger.ON_MOUNT, true);
    }

    disconnectedCallback(): void {
        activeRenderers.delete(this.$renderer);
        this.unsubscribeFromSignals();
        this.onDispose();
    }

    // @ts-ignore
    public template(): Template {
        // @ts-ignore
        return undefined;
    }

    // @ts-ignore
    public onRender(renderTriggers?: RenderTriggerType[]): void {}
    public beforeMount(): void {}
    public onMount(): void {}
    public onDispose(): void {}

    public render(
        renderTrigger?: RenderTriggerType,
        isConnectedCallback = false,
    ): void {
        this.$renderer.schedule(renderTrigger, isConnectedCallback);
    }

    // :thinking: - still like the concept, it may change!
    public setControlStyles(styles: CSSStyleSheet[]): void {
        this.$controlStyles = styles;
    }

    private unsubscribeFromSignals(): void {
        for (const signal of (this.constructor as any).$signals) {
            signal.unsubscribe(this);
        }
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some((c) => c.getAttribute('slot') === name);
    }
}
