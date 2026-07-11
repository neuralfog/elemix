export type QueryRoot = Document | ShadowRoot | Element;

const contextsFor = (root: QueryRoot): QueryRoot[] => {
    const contexts: QueryRoot[] = [root];

    if (root instanceof Element && root.shadowRoot) {
        contexts.push(root.shadowRoot);
    }

    return contexts;
};

export const pierce = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T | null => {
    const contexts = contextsFor(root);

    while (contexts.length) {
        const context = contexts.shift() as QueryRoot;

        const match = context.querySelector<T>(selector);
        if (match) return match;

        for (const el of context.querySelectorAll('*')) {
            if (el.shadowRoot) contexts.push(el.shadowRoot);
        }
    }

    return null;
};

export const pierceAll = <T extends Element = Element>(
    selector: string,
    root: QueryRoot = document,
): T[] => {
    const results: T[] = [];
    const contexts = contextsFor(root);

    while (contexts.length) {
        const context = contexts.shift() as QueryRoot;

        for (const match of context.querySelectorAll<T>(selector)) {
            results.push(match);
        }

        for (const el of context.querySelectorAll('*')) {
            if (el.shadowRoot) contexts.push(el.shadowRoot);
        }
    }

    return results;
};
