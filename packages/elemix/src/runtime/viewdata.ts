let current: unknown;
let picked = false;

export const $__setViewData = (data: unknown): void => {
    current = data;
    picked = true;
};

export const $__viewData = <T = unknown>(): T => {
    if (!picked && typeof window !== 'undefined') {
        current = (window as { __elemix_vd?: unknown }).__elemix_vd;
        picked = true;
    }
    return current as T;
};
