import type { Ref } from './types';

type RefFn = {
    <Value>(): Ref<Value | undefined>;
    <Value>(value: Value): Ref<Value>;
};

export const ref: RefFn = <Value>(value?: Value): Ref<Value | undefined> => ({
    value,
});

const RAW_SKIP = Symbol.for('elemix.raw');

export const raw = <T extends object>(value: T): T => {
    if (Object.isExtensible(value)) {
        Object.defineProperty(value, RAW_SKIP, {
            value: true,
            configurable: true,
        });
    }
    return value;
};
