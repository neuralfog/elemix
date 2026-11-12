import { $__island } from './island';
import { $__isClient } from './state';

type Context = {
    params?: Record<string, string>;
    query?: Record<string, string>;
    csrf?: string;
};

let current: Context | undefined;
let picked = false;

export const $__setContext = (data: unknown): void => {
    current = data as Context | undefined;
    picked = true;
};

export const $__resetContext = (): void => {
    current = undefined;
    picked = false;
};

const context = (): Context => {
    if (!picked && $__isClient()) {
        current = $__island<Context>('__hydris_context');
        picked = true;
    }
    return current ?? {};
};

export const param = (name: string): string | undefined =>
    context().params?.[name];

export const query = (name: string): string | undefined =>
    context().query?.[name];

export const csrf = (): string => context().csrf ?? '';
