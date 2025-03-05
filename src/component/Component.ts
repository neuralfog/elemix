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

    public get root(): HTMLElement | ShadowRoot | null {
        return this.shadowRoot;
    }

    public get props(): ComponentProps {
        return this.$props.data;
    }

    public get styles(): Styles {
        return this.$styles;
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback(): void {
        this.$styles.initialize();
        this.$props.initialize();
        this.$localState.initialize();
        this.beforeMount?.();
        this.render(RenderTrigger.ON_MOUNT, true);
    }

    disconnectedCallback(): void {
        activeRenderers.delete(this.$renderer);
        this.unsubscribeFromSignals();
        this.onDispose?.();
    }

    public template?: () => Template;

    public onRender?: (renderTriggers?: RenderTriggerType[]) => void;

    public beforeMount?: () => void;

    public onMount?: () => void;

    public onDispose?: () => void;

    public render(
        renderTrigger?: RenderTriggerType,
        isConnectedCallback = false,
    ): void {
        this.$renderer.schedule(renderTrigger, isConnectedCallback);
    }

    private unsubscribeFromSignals(): void {
        for (const signal of (this.constructor as any).$signals) {
            signal.unsubscribe(this);
        }
    }
}
