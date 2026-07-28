const TEXT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

const ATTR: Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
};

export const $__ssrText = (value: unknown): string =>
    value == null ? '' : String(value).replace(/[&<>]/g, (c) => TEXT[c] ?? c);

export const $__ssrAttr = (value: unknown): string =>
    value == null ? '' : String(value).replace(/[&"<>]/g, (c) => ATTR[c] ?? c);

export const $__ssrSlot = (_value: unknown): string => '';
