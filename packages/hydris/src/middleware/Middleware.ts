import type { HandlerResult } from '../http/Reply';
import type { Request } from '../http/Request';

export type Next = () => Promise<Response>;

export abstract class BaseMiddleware {
    abstract handle(
        req: Request<any>,
        next: Next,
    ): HandlerResult | Promise<HandlerResult>;
}

export type MiddlewareClass = new (...args: never[]) => BaseMiddleware;

export type Middleware = MiddlewareClass | BaseMiddleware;
