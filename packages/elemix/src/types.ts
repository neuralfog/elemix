export type Template = {
    strings: TemplateStringsArray;
    values: unknown[];
    key: string;
};

export type Ref<Value> = { value: Value };

export type { ElemixApp, ElemixConfig } from './createApp';
