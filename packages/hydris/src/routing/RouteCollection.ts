import type { Handler } from './HandlerDispatcher';
import type { Method } from '../constants';
import { RouteDefinition, type Segment } from './RouteDefinition';

const matchSegments = (
    segments: Segment[],
    parts: string[],
): Record<string, string> | null => {
    const params: Record<string, string> = {};
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if ('wildcard' in seg) {
            params['*'] = parts.slice(i).map(decodeURIComponent).join('/');
            return params;
        }
        if (i >= parts.length) return null;
        if (seg.param) params[seg.name] = decodeURIComponent(parts[i]);
        else if (seg.value !== parts[i]) return null;
    }
    return parts.length === segments.length ? params : null;
};

const rank = (seg: Segment): number =>
    'wildcard' in seg ? 0 : seg.param ? 1 : 2;

const isMoreSpecific = (a: Segment[], b: Segment[]): boolean => {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ra = rank(a[i]);
        const rb = rank(b[i]);
        if (ra !== rb) return ra > rb;
    }
    return a.length > b.length;
};

export type RouteMatch = {
    route: RouteDefinition;
    params: Record<string, string>;
};

export class RouteCollection {
    private routes: RouteDefinition[] = [];

    get size(): number {
        return this.routes.length;
    }

    add(
        method: Method,
        path: string,
        handler: Handler,
        isStatic = false,
    ): RouteDefinition {
        const route: RouteDefinition = {
            method,
            path,
            handler,
            segments: RouteDefinition.compile(path),
            middlewares: [],
            skip: [],
            isStatic,
        };
        this.routes.push(route);
        return route;
    }

    slice(from: number): RouteDefinition[] {
        return this.routes.slice(from);
    }

    match(method: Method, parts: string[]): RouteMatch | null {
        let best: RouteMatch | null = null;
        for (const route of this.routes) {
            if (route.method !== method) continue;
            const params = matchSegments(route.segments, parts);
            if (!params) continue;
            if (
                best === null ||
                isMoreSpecific(route.segments, best.route.segments)
            ) {
                best = { route, params };
            }
        }
        return best;
    }

    allowedMethods(parts: string[]): Method[] {
        const methods: Method[] = [];
        for (const route of this.routes) {
            if (
                matchSegments(route.segments, parts) !== null &&
                !methods.includes(route.method)
            ) {
                methods.push(route.method);
            }
        }
        return methods;
    }
}
