import { KEYED_LIST, type HtmlTemplate, type KeyedList } from './types';

export const repeat = <T = unknown>(
    list: T[],
    callback: (val: T, index: number) => HtmlTemplate,
    key?: (val: T, index: number) => string,
    memo?: (val: T, index: number) => unknown,
): HtmlTemplate[] | KeyedList => {
    if (memo) {
        return {
            [KEYED_LIST]: true,
            list,
            cb: callback as KeyedList['cb'],
            keyFn: key as KeyedList['keyFn'],
            memoFn: memo as KeyedList['memoFn'],
        };
    }
    return list.map((item, index) => {
        const template = callback(item, index);
        template.key = key?.(item, index) || String(index);
        return template;
    });
};

export const when = (
    condition: unknown,
    then: () => HtmlTemplate,
    otherwise?: () => HtmlTemplate,
): HtmlTemplate | string => {
    if (condition) return then();
    return otherwise ? otherwise() : '';
};

export const choose = (
    cases: Array<[condition: unknown, template: () => HtmlTemplate]>,
): HtmlTemplate | string => {
    for (const [condition, template] of cases) {
        if (condition) return template();
    }
    return '';
};
