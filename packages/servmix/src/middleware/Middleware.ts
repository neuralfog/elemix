import type { Context } from '../http/Context';
import type { HandlerResult } from '../http/Reply';

export type Next = () => Promise<Response>;

export abstract class BaseMiddleware {
    abstract handle(
        ctx: Context<any>,
        next: Next,
    ): HandlerResult | Promise<HandlerResult>;
}

export type Middleware = new (...args: never[]) => BaseMiddleware;
