import { initStyles } from './styles';
import {
    reactive,
    collect,
    dispose,
    untrack,
    type Scope,
} from '../runtime/reactive';
import type { Template } from '../types';

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

    public $props?: Record<string, unknown>;
    private connected = false;
    private scopes = new Set<Scope>();

    public internals?: ElementInternals;

    public get root(): HTMLElement | ShadowRoot | null {
        return this.shadowRoot;
    }

    public get props(): ComponentProps {
        return this.$props as ComponentProps;
    }

    public initProps(): void {
        const el = this as unknown as {
            __pendingProps?: Record<string, unknown>;
        };
        this.$props = reactive(el.__pendingProps ?? {});
        el.__pendingProps = undefined;
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.setAttribute('data-cloak', '');
    }

    public template?(): Template;
    public view?(): DocumentFragment;

    public beforeMount?(): void;
    public onMount?(): void;
    public onDispose?(): void;

    connectedCallback(): void {
        if (this.connected) return;
        this.connected = true;

        untrack(() => {
            initStyles(this);
            this.attachFormInternals();
            this.initProps();
            this.beforeMount?.();

            if (this.view) {
                const view = this.view;
                this.shadowRoot?.appendChild(
                    collect(this.scopes, () => view.call(this)),
                );
            }

            this.removeAttribute('data-cloak');
            this.onMount?.();
        });
    }

    private attachFormInternals(): void {
        if (this.internals) return;
        const ctor = this.constructor as typeof Component;
        if (ctor.formAssociated) {
            this.internals = this.attachInternals();
        }
    }

    disconnectedCallback(): void {
        queueMicrotask(() => {
            if (this.isConnected) return;
            untrack(() => {
                for (const scope of this.scopes) dispose(scope);
                this.scopes.clear();
                this.onDispose?.();
            });
        });
    }

    public render(): void {
        for (const scope of this.scopes) scope.rerun();
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some(
            (c) => c.getAttribute('slot') === name,
        );
    }
}
