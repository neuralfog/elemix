import type { Method } from '../constants';
import type { ErrorRenderer } from '../error/ErrorRenderer';
import type { Middleware } from '../middleware/Middleware';
import type { Handler } from './HandlerDispatcher';

export type Segment =
    | { param: false; value: string }
    | { param: true; name: string }
    | { wildcard: true };

export class RouteDefinition {
    declare method: Method;
    declare path: string;
    declare handler: Handler;
    declare segments: Segment[];
    declare middlewares: Middleware[];
    declare skip: Middleware[];
    declare isStatic: boolean;
    declare renderer?: ErrorRenderer;

    static segmentsOf(path: string): string[] {
        return path.split('/').filter(Boolean);
    }

    static compile(path: string): Segment[] {
        return RouteDefinition.segmentsOf(path).map((seg) => {
            if (seg === '*') return { wildcard: true };
            if (seg.startsWith(':')) return { param: true, name: seg.slice(1) };
            return { param: false, value: seg };
        });
    }
}
