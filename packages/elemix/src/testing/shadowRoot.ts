export const queryAll = <T extends HTMLElement = HTMLElement>(
    root: HTMLElement | ShadowRoot,
    selector: string,
): T[] => {
    const results = Array.from(root.querySelectorAll(selector));

    const pushNestedResults = (root: any): void => {
        for (const elem of queryAll(root, selector)) {
            if (!results.includes(elem)) {
                results.push(elem);
            }
        }
    };

    if (root instanceof HTMLElement && root.shadowRoot) {
        pushNestedResults(root.shadowRoot);
    }

    for (const elem of root.querySelectorAll('*')) {
        if (elem.shadowRoot) {
            pushNestedResults(elem.shadowRoot);
        }
    }

    return results as T[];
};

export const query = <T extends HTMLElement = HTMLElement>(
    root: HTMLElement | ShadowRoot,
    selector: string,
): T | undefined => {
    return queryAll<T>(root, selector)[0];
};

export const waitFor = async <T extends HTMLElement = HTMLElement>(
    root: HTMLElement | ShadowRoot,
    selector: string,
    timeoutMs = 2000,
): Promise<T> => {
    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
        const el = query<T>(root, selector);
        if (el) return el;
        await new Promise((r) => setTimeout(r, 25));
    }

    throw new Error(`Timeout waiting for ${selector}`);
};
