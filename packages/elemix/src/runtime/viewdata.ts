import { $__island } from './island';
import { $__isClient } from './state';

let current: unknown;
let picked = false;

export const $__setViewData = (data: unknown): void => {
    current = data;
    picked = true;
};

export const $__viewData = <T = unknown>(): T => {
    if (!picked && $__isClient()) {
        current = $__island('__elemix_vd');
        picked = true;
    }
    return current as T;
};
