import type { ErrorRenderer } from '../error/render';
import type { Middleware } from '../middleware/Middleware';
import type { Handler } from './HandlerDispatcher';
import type { Method } from './Method';

export type Segment =
    | { param: false; value: string }
    | { param: true; name: string }
    | { wildcard: true };

export type RouteDefinition = {
    method: Method;
    path: string;
    handler: Handler;
    segments: Segment[];
    middlewares: Middleware[];
    skip: Middleware[];
    isStatic: boolean;
    renderer?: ErrorRenderer;
};

export const segmentsOf = (path: string): string[] =>
    path.split('/').filter(Boolean);

export const compile = (path: string): Segment[] =>
    segmentsOf(path).map((seg) => {
        if (seg === '*') return { wildcard: true };
        if (seg.startsWith(':')) return { param: true, name: seg.slice(1) };
        return { param: false, value: seg };
    });
