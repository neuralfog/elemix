const g = globalThis as unknown as Record<string, unknown>;

g.__elemix_ssr ??= true;

g.window ??= {};
g.document ??= {
    createElement: () => ({ innerHTML: '', content: {} }),
    importNode: (node: unknown) => node,
};
g.CSSStyleSheet ??= class {
    replaceSync(): void {}
};
// A real tag -> constructor registry, not a no-op: SSR looks children up by tag
// (`$__ssrChild`) to render each nested component's `$$__ssr()` inline, so the
// definitions the compiled output registers must actually be retrievable.
const registry = new Map<string, unknown>();
g.customElements ??= {
    get: (tag: string) => registry.get(tag),
    define: (tag: string, ctor: unknown) => {
        if (!registry.has(tag)) registry.set(tag, ctor);
    },
};
g.HTMLElement ??= class {
    children: unknown[] = [];
    attachShadow(): unknown {
        return {};
    }
    attachInternals(): unknown {
        return { setFormValue(): void {}, setValidity(): void {}, form: null };
    }
    getAttribute(): string | null {
        return null;
    }
    setAttribute(): void {}
    removeAttribute(): void {}
};
