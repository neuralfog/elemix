import { KEYED_LIST, type HtmlTemplate, type KeyedList } from './types';

const identityKeys = new WeakMap<object, string>();
let identityCounter = 0;

const identityKey = (item: unknown, index: number): string => {
    if (item !== null && typeof item === 'object') {
        let key = identityKeys.get(item);
        if (key === undefined) {
            key = `@${identityCounter++}`;
            identityKeys.set(item, key);
        }
        return key;
    }
    return String(index);
};

export const repeat = <T = unknown>(
    list: T[],
    callback: (val: T, index: number) => HtmlTemplate,
    key?: (val: T, index: number) => string,
): KeyedList => {
    const keyOf: (val: T, index: number) => string = key
        ? (item, index) => key(item, index) || String(index)
        : identityKey;

    return {
        [KEYED_LIST]: true,
        list,
        cb: callback as KeyedList['cb'],
        keyFn: keyOf as KeyedList['keyFn'],
    };
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
