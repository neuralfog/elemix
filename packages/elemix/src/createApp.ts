export type ElemixConfig = {
    cloak?: string;
    shadow?: boolean;
};

export type ElemixApp = {
    config(patch: Partial<ElemixConfig>): ElemixApp;
    mount(target: string | Element): ElemixApp;
};

declare global {
    interface Window {
        __elemix__?: { config: ElemixConfig };
    }
}

const setConfig = (patch: Partial<ElemixConfig>): void => {
    window.__elemix__ = {
        config: { ...(window.__elemix__?.config ?? {}), ...patch },
    };
};

export const createApp = (root?: CustomElementConstructor): ElemixApp => {
    const app: ElemixApp = {
        config(patch) {
            setConfig(patch);
            return app;
        },
        mount(target) {
            if (!root) return app;
            const host =
                typeof target === 'string'
                    ? document.querySelector(target)
                    : target;
            const tag = customElements.getName(root);
            if (host && tag) {
                host.insertAdjacentHTML('beforeend', `<${tag}></${tag}>`);
            }
            return app;
        },
    };

    return app;
};
