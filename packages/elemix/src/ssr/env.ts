const g = globalThis as unknown as Record<string, unknown>;

g.__elemix_ssr ??= true;

g.console ??= {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {},
};

g.window ??= {};
g.document ??= {
    createElement: () => ({ innerHTML: '', content: {} }),
    importNode: (node: unknown) => node,
};
g.CSSStyleSheet ??= class {
    replaceSync(): void {}
};

const registry = new Map<string, unknown>();
g.customElements ??= {
    get: (tag: string) => registry.get(tag),
    define: (tag: string, ctor: unknown) => {
        if (!registry.has(tag)) registry.set(tag, ctor);
    },
};
