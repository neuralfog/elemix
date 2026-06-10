import type { Ref } from './types';

type RefFn = {
    <Value>(): Ref<Value | undefined>;
    <Value>(value: Value): Ref<Value>;
};

export const ref: RefFn = <Value>(value?: Value): Ref<Value | undefined> => ({
    value,
});

export const mergeClasses = (a: string, b: string): string => {
    const seen = new Set<string>();
    let out = '';
    const add = (s: string) => {
        const parts = s.split(' ');
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p && !seen.has(p)) {
                seen.add(p);
                if (out.length) out += ' ';
                out += p;
            }
        }
    };
    add(a);
    add(b);
    return out;
};
