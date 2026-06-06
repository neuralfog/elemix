import { RenderTrigger, type RenderTriggerType, type Template } from '../types';
import { Renderer } from './Renderer';
import { LocalState } from './LocalState';
import { Props } from './Props';
import { Styles } from './Styles';
import { activeRenderers } from '../renderers';

type Trackable = { unsubscribe(c: Component): unknown };

export class Component<ComponentProps = unknown> extends HTMLElement {
    public static formAssociated?: boolean;

    private $props = new Props<ComponentProps>(this);
    private $renderer = new Renderer(this);
    private $localState = new LocalState(this);
    private $styles = new Styles(this);
    private $controlStyles?: CSSStyleSheet[];

    public internals?: ElementInternals;

    /**
     * Signals auto-subscribed during template() execution via the
     * renderTracking mechanism. Cleared and rebuilt on every render so
     * conditional reads correctly add and remove subscriptions.
     */
    public tracked = new Set<Trackable>();

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
        this.$localState.initialize();
        this.beforeMount();
        this.render(RenderTrigger.ON_MOUNT, true);
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

    // @Note @Question Not entirly sure of this, I noticed that I start to abuse it :|
    // Can I come up with anything better, this may run a lot by a design
    // Executing render does not mean DOM mutations will happen, it just means that
    // template() was reevaluated and render() called, in most cases I am looking for
    // state change, although this seesm to be falling in watcher space from Vue
    // which I don't love, same principal easy to abuse cause of convienince
    //
    // State change == dom mutation
    // Could renderer return dirty flag ?? based on that invoke a hook for changes based on
    // real dom mutation ?? :thinking:

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
