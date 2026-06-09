export type HtmlTemplate = {
    strings: TemplateStringsArray;
    values: unknown[];
    key: string;
};

export type Hole = (value: unknown) => void;

export type Fragment = {
    mount(target: ParentNode, values: unknown[]): void;
    mountBefore(ref: ChildNode, values: unknown[]): ChildNode[];
    mountInto(target: ParentNode, values: unknown[]): ChildNode[];
    update(values: unknown[]): void;
};

export const MARKER = '₥';

export const Attr = {
    EVENT: 0,
    PROP: 1,
    MODEL: 2,
    STD: 3,
    REF: 4,
    DIRECT_CLASS: 5,
    DIRECT_PROP: 6,
    ONMODEL: 7,
} as const;

export type Attr = (typeof Attr)[keyof typeof Attr];

export type AttrDef = {
    index: number;
    name: string;
    value: string;
    virtual: boolean;
    type: Attr;
};

export const KEYED_LIST = Symbol('keyedList');

export type KeyedList = {
    [KEYED_LIST]: true;
    list: unknown[];
    cb: (val: unknown, index: number) => HtmlTemplate;
    keyFn?: (val: unknown, index: number) => string;
};
