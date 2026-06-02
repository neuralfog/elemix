import type { Fragment, HtmlTemplate } from './types';
import { createFragment } from './fragment';

export const html = (
    strings: TemplateStringsArray,
    ...values: unknown[]
): HtmlTemplate => ({ strings, values, key: '' });

const CACHE = Symbol();

type CachedElement = HTMLElement & {
    [CACHE]?: Map<TemplateStringsArray, Fragment>;
};

export const render = (
    template: HtmlTemplate,
    container: HTMLElement | null,
): void => {
    if (!container) {
        throw new Error(
            'render method needs to accept instance of HTMLElement',
        );
    }

    const el = container as CachedElement;
    if (!el[CACHE]) el[CACHE] = new Map();
    const cache = el[CACHE];
    let frag = cache.get(template.strings);

    if (!frag) {
        frag = createFragment(template);
        cache.set(template.strings, frag);
        frag.mount(container, template.values);
    }

    frag.update(template.values);
};
