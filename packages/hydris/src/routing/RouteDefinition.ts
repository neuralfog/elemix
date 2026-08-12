import type { ErrorRenderer } from '../error/render';
import type { Middleware } from '../middleware/Middleware';
import type { Handler } from './HandlerDispatcher';
import type { Method } from './Method';

export type Segment =
    | { param: false; value: string }
    | { param: true; name: string }
    | { wildcard: true };

export interface RouteDefinition {
    method: Method;
    path: string;
    handler: Handler;
    segments: Segment[];
    middlewares: Middleware[];
    skip: Middleware[];
    isStatic: boolean;
    renderer?: ErrorRenderer;
}

export const compile = (path: string): Segment[] =>
    path
        .split('/')
        .filter(Boolean)
        .map((seg) => {
            if (seg === '*') return { wildcard: true };
            if (seg.startsWith(':')) return { param: true, name: seg.slice(1) };
            return { param: false, value: seg };
        });
