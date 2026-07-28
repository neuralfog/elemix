import type { ErrorRenderer } from '../error/render';
import type { Middleware } from '../middleware/Middleware';
import type { Handler } from './HandlerDispatcher';
import type { Method } from './Method';

export type Segment =
    | { param: false; value: string }
    | { param: true; name: string };

export interface RouteDefinition {
    method: Method;
    path: string;
    handler: Handler;
    segments: Segment[];
    middlewares: Middleware[];
    renderer?: ErrorRenderer;
}

export const compile = (path: string): Segment[] =>
    path
        .split('/')
        .filter(Boolean)
        .map((seg) =>
            seg.startsWith(':')
                ? { param: true, name: seg.slice(1) }
                : { param: false, value: seg },
        );
