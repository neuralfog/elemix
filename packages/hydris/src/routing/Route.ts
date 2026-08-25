import type { ErrorRenderer } from '../error/ErrorRenderer';
import type { Middleware } from '../middleware/Middleware';
import type { HandlerFn, HandlerRef } from './HandlerDispatcher';
import { Method } from '../constants';
import { RouteDefinition } from './RouteDefinition';
import { Router } from './Router';

export const router = new Router();
export const container = router.container;

const join = (base: string, path: string): string => {
    const segments = RouteDefinition.segmentsOf(`${base}/${path}`);
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
        return Route.make(Method.Get, path, handler);
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
            Route.make(Method.Get, join(basePath, kebab(name)), [
                controller,
                name,
            ] as unknown as HandlerRef<T>);
        }
    }

    static head<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Head, path, handler);
    }

    static post<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Post, path, handler);
    }

    static put<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Put, path, handler);
    }

    static patch<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Patch, path, handler);
    }

    static delete<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Delete, path, handler);
    }

    static connect<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Connect, path, handler);
    }

    static options<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Options, path, handler);
    }

    static trace<T extends object>(
        path: string,
        handler: HandlerFn | HandlerRef<T>,
    ): RouteBuilder {
        return Route.make(Method.Trace, path, handler);
    }
}
