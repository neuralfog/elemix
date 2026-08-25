import type { HandlerResult } from '../http/Reply';
import type { Request } from '../http/Request';

export abstract class ErrorHandler {
    abstract render(
        error: unknown,
        req: Request,
    ): HandlerResult | Promise<HandlerResult>;

    static isClass(value: unknown): value is ErrorHandlerClass {
        return (
            typeof value === 'function' &&
            (value as { prototype?: unknown }).prototype instanceof ErrorHandler
        );
    }
}

export type ErrorHandlerClass = new (...args: never[]) => ErrorHandler;
