import type { HandlerResult } from '../http/Reply';
import type { Request } from '../http/Request';

export abstract class ErrorHandler {
    abstract render(
        error: unknown,
        req: Request,
    ): HandlerResult | Promise<HandlerResult>;
}

export type ErrorHandlerClass = new (...args: never[]) => ErrorHandler;

export const isErrorHandlerClass = (
    value: unknown,
): value is ErrorHandlerClass =>
    typeof value === 'function' &&
    (value as { prototype?: unknown }).prototype instanceof ErrorHandler;
