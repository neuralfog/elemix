import {
    $__reactive,
    collect,
    takeScopes,
    rerun,
    dispose,
    $__untrack,
    type Scope,
} from '../runtime/reactive';
import { $__sheet } from '../runtime/dom';
import type { Template } from '../types';

type LifecycleHooks = {
    $$__beforeMount?(): void;
    $$__onMount?(): void;
    $$__onDispose?(): void;
};

const DEFAULT_CLOAK = '[data-cloak],:not(:defined){visibility:hidden}';

let cloakSheet: CSSStyleSheet | undefined;

const cloak = (): CSSStyleSheet => {
    if (!cloakSheet) {
        cloakSheet = new CSSStyleSheet();
        cloakSheet.replaceSync(
            window.__elemix__?.config?.cloak ?? DEFAULT_CLOAK,
        );
        document.adoptedStyleSheets = [
            ...(document.adoptedStyleSheets ?? []),
            cloakSheet,
        ];
    }
    return cloakSheet;
};

export class Component<ComponentProps = unknown> extends HTMLElement {
    public static formAssociated?: boolean;
    public static $$__sheets?: CSSStyleSheet[];
    public static $$__noShadow?: boolean;
    public static $$__shadow?: boolean;
    private $$__props?: Record<string, unknown>;
    private $$__scopes: Scope | null = null;
    private $$__effectScopes: Scope | null = null;
    private connected = false;
    public isMounted = false;
    public internals!: ElementInternals;

    public get root(): HTMLElement | ShadowRoot {
        return this.shadowRoot ?? this;
    }

    public get props(): ComponentProps {
        return this.$$__props as ComponentProps;
    }

    public $$__initProps(): void {
        const el = this as unknown as {
            $$__pendingProps?: Record<string, unknown>;
        };
        this.$$__props = $__reactive(el.$$__pendingProps ?? {});
        el.$$__pendingProps = undefined;
    }

    constructor() {
        super();
        const ctor = this.constructor as typeof Component;
        const useShadow = ctor.$$__shadow
            ? true
            : ctor.$$__noShadow
              ? false
              : (window.__elemix__?.config?.shadow ?? true);
        if (useShadow) {
            this.attachShadow({ mode: 'open' });
        }
        this.setAttribute('data-cloak', '');
    }

    public template?(): Template;
    public $$__view?(): DocumentFragment;
    public $$__effects?(): void;

    connectedCallback(): void {
        if (this.connected) return;
        this.connected = true;

        $__untrack(() => {
            this.$$__adoptStyles();
            this.$$__attachFormInternals();
            this.$$__initProps();
            (this as LifecycleHooks).$$__beforeMount?.();

            if (this.$$__view) {
                const view = this.$$__view;
                const frag = collect(() => view.call(this));
                this.$$__scopes = takeScopes();
                (this.shadowRoot ?? this).appendChild(frag);
            }

            if (this.$$__effects) {
                const effects = this.$$__effects;
                collect(() => effects.call(this));
                this.$$__effectScopes = takeScopes();
            }

            this.removeAttribute('data-cloak');
            (this as LifecycleHooks).$$__onMount?.();
        });

        this.isMounted = true;
    }

    private $$__attachFormInternals(): void {
        if (this.internals) return;
        const ctor = this.constructor as typeof Component;
        if (ctor.formAssociated) {
            this.internals = this.attachInternals();
        }
    }

    disconnectedCallback(): void {
        queueMicrotask(() => {
            if (this.isConnected) return;
            $__untrack(() => {
                dispose(this.$$__scopes);
                this.$$__scopes = null;
                dispose(this.$$__effectScopes);
                this.$$__effectScopes = null;
                (this as LifecycleHooks).$$__onDispose?.();
            });
            this.isMounted = false;
        });
    }

    public render(): void {
        let scope = this.$$__scopes;
        while (scope) {
            rerun(scope);
            scope = scope.next;
        }
    }

    public $$__adoptStyles(
        input?: string | CSSStyleSheet | ReadonlyArray<string | CSSStyleSheet>,
    ): void {
        cloak();
        const sheets =
            input !== undefined
                ? $__sheet(input)
                : (this.constructor as typeof Component).$$__sheets;
        if (this.shadowRoot && sheets?.length) {
            this.shadowRoot.adoptedStyleSheets = sheets;
        }
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some(
            (c) => c.getAttribute('slot') === name,
        );
    }
}
