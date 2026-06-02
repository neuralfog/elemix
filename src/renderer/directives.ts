import type { HtmlTemplate } from './types';

export const repeat = <T = unknown>(
    list: T[],
    callback: (val: T, index: number) => HtmlTemplate,
    key?: (val: T, index: number) => string,
): HtmlTemplate[] => {
    return list.map((item, index) => {
        const template = callback(item, index);
        template.key = key?.(item, index) || String(index);
        return template;
    });
};
