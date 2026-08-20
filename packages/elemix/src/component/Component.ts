import {
    collect,
    takeScopes,
    rerun,
    dispose,
    $__untrack,
    type Scope,
} from '../runtime/reactive';
import { $__reactive } from '../runtime/state';
import { $__viewData } from '../runtime/viewdata';
import { $__hydrating, $__sheet } from '../runtime/dom';
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

let resetSheet: CSSStyleSheet | undefined;
let resetSource: string | undefined;

const reset = (): CSSStyleSheet | undefined => {
    const source = window.__elemix__?.config?.reset;
    if (!source) return undefined;
    if (source !== resetSource) {
        resetSheet = new CSSStyleSheet();
        resetSheet.replaceSync(source);
        resetSource = source;
    }
    return resetSheet;
};

let resetDocumentDone = false;

const resetDocument = (): void => {
    if (resetDocumentDone) return;
    const sheet = reset();
    if (!sheet) return;
    document.adoptedStyleSheets = [
        ...(document.adoptedStyleSheets ?? []),
        sheet,
    ];
    resetDocumentDone = true;
};

export class Component<
    ComponentProps = unknown,
    ViewData = unknown,
> extends HTMLElement {
    public static formAssociated?: boolean;
    public static $$__module?: string;
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

    public get viewData(): ViewData {
        return $__viewData<ViewData>();
    }

    public $$__initProps(): void {
        const el = this as unknown as {
            $$__pendingProps?: Record<string, unknown>;
        };
        let props = el.$$__pendingProps ?? {};
        const data = this.getAttribute('data-h');
        if (data !== null) {
            props = { ...JSON.parse(data), ...props };
            this.removeAttribute('data-h');
        }
        this.$$__props = $__reactive(props) as Record<string, unknown>;
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
        if (useShadow && !this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }
        this.setAttribute('data-cloak', '');
    }

    public template?(): Template;
    public $$__view?(): DocumentFragment;
    public $$__hydrate?(root: Node): void;
    public $$__effects?(): void;

    connectedCallback(): void {
        if (this.connected) return;
        this.connected = true;

        const root = this.shadowRoot ?? this;
        const hydrating = Boolean(this.$$__hydrate && root.firstChild);

        $__untrack(() => {
            this.$$__adoptStyles();
            this.$$__attachFormInternals();
            this.$$__initProps();
            (this as LifecycleHooks).$$__beforeMount?.();

            if (hydrating && this.$$__hydrate) {
                const hydrate = this.$$__hydrate;
                root.querySelector('style[data-ssr]')?.remove();
                $__hydrating(true);
                collect(() => hydrate.call(this, root));
                this.$$__scopes = takeScopes();
                $__hydrating(false);
            } else if (this.$$__view) {
                const view = this.$$__view;
                const frag = collect(() => view.call(this));
                this.$$__scopes = takeScopes();
                root.appendChild(frag);
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
        resetDocument();
        const sheets =
            input !== undefined
                ? $__sheet(input)
                : (this.constructor as typeof Component).$$__sheets;
        if (!this.shadowRoot) return;
        const base = reset();
        const all = base ? [base, ...(sheets ?? [])] : sheets;
        if (all?.length) {
            this.shadowRoot.adoptedStyleSheets = all;
        }
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children).some(
            (c) => c.getAttribute('slot') === name,
        );
    }
}
