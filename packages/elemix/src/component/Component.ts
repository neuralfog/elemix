import type { Template } from '../types';
import { Renderer } from './Renderer';
import { Props } from './Props';
import { Styles } from './Styles';
import { activeRenderers, versionOf } from '../renderers';

type Trackable = { unsubscribe(c: Component): unknown };

export const defineComponent = (
    tag: string,
    component: CustomElementConstructor,
): void => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, component);
    }
};

export class Component<ComponentProps = unknown> extends HTMLElement {
    public static formAssociated?: boolean;
    public static styles?: string[];

    private $props = new Props<ComponentProps>(this);
    private $renderer = new Renderer(this);
    private $styles = new Styles(this);
    private $controlStyles?: CSSStyleSheet[];

    public internals?: ElementInternals;

    /**
     * Signals auto-subscribed during template() execution via the
     * renderTracking mechanism. Cleared and rebuilt on every render so
     * conditional reads correctly add and remove subscriptions.
     */
    public tracked = new Set<Trackable>();

    /**
     * Per-object dependency versions captured during the last render. Lets the
     * renderer skip a re-render when nothing the component actually read has
     * changed, instead of re-rendering on every notify().
     */
    public deps = new Map<object, number>();

    public isDirty(): boolean {
        for (const [obj, version] of this.deps) {
            if (versionOf(obj) !== version) return true;
        }
        return false;
    }

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
        this.$styles.initialize();
        this.$props.initialize();
        this.attachFormInternals();
        this.beforeMount();
        this.render(true);
    }

    private attachFormInternals(): void {
        if (this.internals) return;
        const ctor = this.constructor as typeof Component;
        if (ctor.formAssociated) {
            this.internals = this.attachInternals();
        }
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

    public onMutation(): void {}
    public beforeMount(): void {}
    public onMount(): void {}
    public onDispose(): void {}

    public render(isConnectedCallback = false): void {
        this.$renderer.schedule(isConnectedCallback);
    }

    // :thinking: - still like the concept, it may change!
    public setControlStyles(styles: CSSStyleSheet[]): void {
        this.$controlStyles = styles;
    }

    private unsubscribeFromSignals(): void {
        for (const sig of this.tracked) {
            sig.unsubscribe(this);
        }
        this.tracked.clear();
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some(
            (c) => c.getAttribute('slot') === name,
        );
    }
}
