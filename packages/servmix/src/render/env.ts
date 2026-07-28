const g = globalThis as unknown as Record<string, unknown>;

g.window ??= {};
g.document ??= {
    createElement: () => ({ innerHTML: '', content: {} }),
    importNode: (node: unknown) => node,
};
g.CSSStyleSheet ??= class {
    replaceSync(): void {}
};
g.customElements ??= {
    get: () => undefined,
    define: () => {},
};
g.HTMLElement ??= class {
    attachShadow(): unknown {
        return {};
    }
    attachInternals(): unknown {
        return {};
    }
    setAttribute(): void {}
    removeAttribute(): void {}
};
