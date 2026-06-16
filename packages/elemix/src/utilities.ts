import type { Ref } from './types';

type RefFn = {
    <Value>(): Ref<Value | undefined>;
    <Value>(value: Value): Ref<Value>;
};

export const ref: RefFn = <Value>(value?: Value): Ref<Value | undefined> => ({
    value,
});
