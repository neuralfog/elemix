import type { Template } from '../types';
import { uncompiled } from '../uncompiled';

export const repeat = <T = unknown>(
    _list: T[],
    _callback: (val: T, index: number) => Template,
    _key?: (val: T, index: number) => string | number,
): Template => uncompiled('repeat');

export const when = (
    _condition: unknown,
    _then: () => Template,
    _otherwise?: () => Template,
): Template => uncompiled('when');

export const choose = (
    _cases: Array<[condition: unknown, template: () => Template]>,
): Template => uncompiled('choose');

type MatchWidened<T> = Record<never, 0> extends Record<T & PropertyKey, 0>
    ? true
    : false;

type MatchOpenError =
    'elemix match(): value must be a finite literal-union or enum type - use choose() for open conditions';

export function match<T extends PropertyKey>(
    value: T,
    cases: MatchWidened<T> extends true
        ? MatchOpenError
        : Record<T, () => Template>,
): Template;
export function match<T extends object, K extends keyof T>(
    value: T,
    key: T[K] extends PropertyKey ? K : never,
    cases: MatchWidened<T[K]> extends true
        ? MatchOpenError
        : {
              [V in T[K] & PropertyKey]: (
                  member: Extract<T, Record<K, V>>,
              ) => Template;
          },
): Template;
export function match(..._args: unknown[]): Template {
    return uncompiled('match');
}
