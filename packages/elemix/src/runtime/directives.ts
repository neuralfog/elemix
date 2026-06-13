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
