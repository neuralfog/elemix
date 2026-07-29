import type { Handler } from './HandlerDispatcher';
import type { Method } from './Method';
import { compile, type RouteDefinition, type Segment } from './RouteDefinition';

const matchSegments = (
    segments: Segment[],
    parts: string[],
): Record<string, string> | null => {
    if (segments.length !== parts.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.param) params[seg.name] = decodeURIComponent(parts[i]);
        else if (seg.value !== parts[i]) return null;
    }
    return params;
};

const isMoreSpecific = (a: Segment[], b: Segment[]): boolean => {
    for (let i = 0; i < a.length; i++) {
        if (a[i].param !== b[i].param) return !a[i].param;
    }
    return false;
};

export interface RouteMatch {
    route: RouteDefinition;
    params: Record<string, string>;
}

export class RouteCollection {
    private routes: RouteDefinition[] = [];

    get size(): number {
        return this.routes.length;
    }

    add(method: Method, path: string, handler: Handler): RouteDefinition {
        const route: RouteDefinition = {
            method,
            path,
            handler,
            segments: compile(path),
            middlewares: [],
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
