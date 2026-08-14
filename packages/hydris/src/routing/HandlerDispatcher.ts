import type { DiContainer } from '../container/DiContainer';
import type { TokenLike } from '../container/Token';
import type { HandlerResult } from '../http/Reply';
import type { Request } from '../http/Request';

export type HandlerFn = (
    req: Request<any>,
) => HandlerResult | Promise<HandlerResult>;

type HandlerMethod = (...args: any[]) => HandlerResult | Promise<HandlerResult>;

export type HandlerMethods<T> = {
    [K in keyof T]: T[K] extends HandlerMethod ? K : never;
}[keyof T];

export type HandlerRef<T extends object> = readonly [
    new (...args: never[]) => T,
    HandlerMethods<T>,
];

export type Handler =
    | HandlerFn
    | readonly [new (...args: never[]) => object, PropertyKey];

const INJECT_METHODS = Symbol.for('ssr.inject.methods');

type MethodTable = Record<PropertyKey, readonly TokenLike<unknown>[]>;

export const invokeHandler = (
    handler: Handler,
    scope: DiContainer,
    req: Request,
): HandlerResult | Promise<HandlerResult> => {
    if (typeof handler === 'function') return handler(req);
    const [HandlerClass, method] = handler;
    const instance = scope.get(HandlerClass) as Record<
        PropertyKey,
        (...args: unknown[]) => HandlerResult | Promise<HandlerResult>
    >;
    const table = (HandlerClass as { [INJECT_METHODS]?: MethodTable })[
        INJECT_METHODS
    ];
    const deps = table?.[method];
    if (deps) {
        return instance[method](...deps.map((dep) => scope.get(dep)));
    }
    return instance[method](req);
};
