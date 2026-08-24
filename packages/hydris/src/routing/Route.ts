import type { ErrorRenderer } from '../error/render';
import type { Middleware } from '../middleware/Middleware';
import type { HandlerFn, HandlerRef } from './HandlerDispatcher';
import type { Method } from './Method';
import { segmentsOf, type RouteDefinition } from './RouteDefinition';
import { Router } from './Router';

export const router = new Router();
export const container = router.container;

const join = (base: string, path: string): string => {
    const segments = segmentsOf(`${base}/${path}`);
    return `/${segments.join('/')}`;
};

const kebab = (name: string): string =>
    name
        .replace(/_/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();

class RouteBuilder {
    constructor(private readonly definition: RouteDefinition) {}

    middlewares(middlewares: Middleware[]): this {
        this.definition.middlewares.push(...middlewares);
        return this;
    }

    skipMiddlewares(middlewares: Middleware[]): this {
        this.definition.skip.push(...middlewares);
        return this;
    }

    renderError(renderer: ErrorRenderer): this {
        this.definition.renderer = renderer;
        return this;
    }
}

class GroupBuilder {
    constructor(
        private readonly routes: RouteDefinition[],
        private readonly prefix: string,
    ) {}

    middlewares(middlewares: Middleware[]): this {
        for (const route of this.routes) {
            route.middlewares.unshift(...middlewares);
        }
        return this;
    }

    skipMiddlewares(middlewares: Middleware[]): this {
        for (const route of this.routes) {
            route.skip.push(...middlewares);
        }
        return this;
    }

    renderError(renderer: ErrorRenderer): this {
        router.applyErrorRenderer(this.routes, this.prefix, renderer);
        return this;
    }
}

export class Route {
    private static prefix = '';

    static __file(name: string): void {
        router.setFile(name);
    }

    private static make<T extends object>(
        method: Method,
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return new RouteBuilder(
            router.register(method, join(Route.prefix, path), handler),
        );
    }

    static group(define: () => void): GroupBuilder;
    static group(prefix: string, define: () => void): GroupBuilder;
    static group(
        prefixOrDefine: string | (() => void),
        maybeDefine?: () => void,
    ): GroupBuilder {
        const prefix = typeof prefixOrDefine === 'string' ? prefixOrDefine : '';
        const define =
            typeof prefixOrDefine === 'string'
                ? (maybeDefine as () => void)
                : prefixOrDefine;
        const parent = Route.prefix;
        const full = join(parent, prefix);
        Route.prefix = full;
        const start = router.size;
        try {
            define();
        } finally {
            Route.prefix = parent;
        }
        return new GroupBuilder(router.slice(start), full);
    }

    static get<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('GET', path, handler);
    }

    static getAll<T extends object>(
        basePath: string,
        controller: new (...args: never[]) => T,
    ): void {
        const proto = controller.prototype as object;
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (name === 'constructor') continue;
            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            if (typeof descriptor?.value !== 'function') continue;
            Route.make('GET', join(basePath, kebab(name)), [
                controller,
                name,
            ] as unknown as HandlerRef<T>);
        }
    }

    static head<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('HEAD', path, handler);
    }

    static post<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('POST', path, handler);
    }

    static put<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('PUT', path, handler);
    }

    static patch<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('PATCH', path, handler);
    }

    static delete<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('DELETE', path, handler);
    }

    static connect<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('CONNECT', path, handler);
    }

    static options<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('OPTIONS', path, handler);
    }

    static trace<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make('TRACE', path, handler);
    }
}
