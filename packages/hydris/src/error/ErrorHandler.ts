import type { Context } from '../http/Context';
import type { HandlerResult } from '../http/Reply';

export abstract class ErrorHandler {
    abstract render(
        error: unknown,
        ctx: Context,
    ): HandlerResult | Promise<HandlerResult>;
}

export type ErrorHandlerClass = new (...args: never[]) => ErrorHandler;

export const isErrorHandlerClass = (
    value: unknown,
): value is ErrorHandlerClass =>
    typeof value === 'function' &&
    (value as { prototype?: unknown }).prototype instanceof ErrorHandler;
