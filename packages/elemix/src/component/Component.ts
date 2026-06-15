import {
    reactive,
    collect,
    takeScopes,
    rerun,
    dispose,
    untrack,
    type Scope,
} from '../runtime/reactive';
import { sheet } from '../runtime/dom';
import type { Template } from '../types';

export class Component<ComponentProps = unknown> extends HTMLElement {
    public static formAssociated?: boolean;
    public static __sheets?: CSSStyleSheet[];
    public $props?: Record<string, unknown>;
    private connected = false;
    private scopes: Scope | null = null;
    public internals!: ElementInternals;

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
            this.adoptStyles();
            this.attachFormInternals();
            this.initProps();
            this.beforeMount?.();

            if (this.view) {
                const view = this.view;
                const frag = collect(() => view.call(this));
                this.scopes = takeScopes();
                this.shadowRoot?.appendChild(frag);
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
                dispose(this.scopes);
                this.scopes = null;
                this.onDispose?.();
            });
        });
    }

    public render(): void {
        let scope = this.scopes;
        while (scope) {
            rerun(scope);
            scope = scope.next;
        }
    }

    public adoptStyles(
        input?: string | CSSStyleSheet | ReadonlyArray<string | CSSStyleSheet>,
    ): void {
        const sheets =
            input !== undefined
                ? sheet(input)
                : (this.constructor as typeof Component).__sheets;
        if (this.shadowRoot && sheets && sheets.length) {
            this.shadowRoot.adoptedStyleSheets = sheets;
        }
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some(
            (c) => c.getAttribute('slot') === name,
        );
    }
}
