import { DiContainer } from '../container/DiContainer';
import { isErrorHandlerClass } from '../error/ErrorHandler';
import {
    type ErrorRenderer,
    type ErrorReporter,
    defaultErrorRenderer,
} from '../error/render';
import {
    MethodNotAllowedException,
    NotFoundException,
} from '../error/HttpException';
import { Context } from '../http/Context';
import { type HandlerResult, toResponse } from '../http/Reply';
import { Request } from '../http/Request';
import type { Middleware } from '../middleware/Middleware';
import { type ErrorSink, Pipeline } from '../middleware/Pipeline';
import { type Handler, invokeHandler } from './HandlerDispatcher';
import { MatchedRoute } from './MatchedRoute';
import type { Method } from './Method';
import { RouteCollection } from './RouteCollection';
import type { RouteDefinition } from './RouteDefinition';

const pathnameOf = (url: string): string => {
    const start = url.indexOf('/', url.indexOf('://') + 3);
    if (start === -1) return '/';
    const query = url.indexOf('?', start);
    return query === -1 ? url.slice(start) : url.slice(start, query);
};

const callerFile = (): string | null => {
    const stack = new Error().stack;
    if (stack === undefined) return null;
    for (const line of stack.split('\n')) {
        const match = line.match(/([^()\s]+\.[tj]s):\d+:\d+/);
        if (match === null) continue;
        const path = match[1];
        if (
            /\/routing\/Router\.[tj]s$/.test(path) ||
            /\/routing\/Route\.[tj]s$/.test(path)
        ) {
            continue;
        }
        return (path.split('/').pop() ?? '').replace(/\.[tj]s$/, '');
    }
    return null;
};

interface PrefixRenderer {
    prefix: string;
    renderer: ErrorRenderer;
}

interface NamedGroup {
    routes: RouteDefinition[];
    prefix: string;
}

export class Router {
    private readonly routes = new RouteCollection();
    private globalMiddlewares: Middleware[] = [];
    private reporters: ErrorReporter[] = [];
    private renderer: ErrorRenderer | null = null;
    private prefixRenderers: PrefixRenderer[] = [];
    private namedGroups = new Map<string, NamedGroup>();
    private pendingFile: string | null = null;
    readonly container: DiContainer;

    constructor(container: DiContainer = new DiContainer()) {
        this.container = container;
    }

    get size(): number {
        return this.routes.size;
    }

    use(middlewares: Middleware[]): void {
        this.globalMiddlewares.push(...middlewares);
    }

    onError(reporter: ErrorReporter): void {
        this.reporters.push(reporter);
    }

    renderError(renderer: ErrorRenderer): void {
        this.renderer = renderer;
    }

    renderErrorFor(prefix: string, renderer: ErrorRenderer): void {
        this.prefixRenderers.push({ prefix, renderer });
    }

    nameGroup(name: string, routes: RouteDefinition[], prefix: string): void {
        const existing = this.namedGroups.get(name);
        if (existing) existing.routes.push(...routes);
        else this.namedGroups.set(name, { routes: [...routes], prefix });
    }

    setFile(name: string | null): void {
        this.pendingFile = name;
    }

    renderErrorForName(name: string, renderer: ErrorRenderer): void {
        const group = this.namedGroups.get(name);
        if (group === undefined) {
            throw new Error(`No route group named "${name}"`);
        }
        this.applyErrorRenderer(group.routes, group.prefix, renderer);
    }

    applyErrorRenderer(
        routes: RouteDefinition[],
        prefix: string,
        renderer: ErrorRenderer,
    ): void {
        for (const route of routes) {
            if (route.renderer === undefined) route.renderer = renderer;
        }
        const prefixes =
            prefix === '/' ? routes.map((route) => route.path) : [prefix];
        for (const p of prefixes) this.renderErrorFor(p, renderer);
    }

    slice(from: number): RouteDefinition[] {
        return this.routes.slice(from);
    }

    register(method: Method, path: string, handler: Handler): RouteDefinition {
        const route = this.routes.add(method, path, handler);
        const file = this.pendingFile ?? callerFile();
        if (file !== null) this.nameGroup(file, [route], '/');
        return route;
    }

    async dispatch(req: Request): Promise<Response> {
        const parts = pathnameOf(req.url).split('/').filter(Boolean);
        const matched = this.routes.match(req.method as Method, parts);

        const scope = this.container.scope();
        req.id = Bun.randomUUIDv7();
        req.bag = {};
        const route = matched
            ? new MatchedRoute(matched.route, matched.params)
            : null;
        const ctx = new Context(req, route);
        scope.value(Context, ctx);
        scope.value(DiContainer, scope);
        scope.value(Request, req);
        if (route) scope.value(MatchedRoute, route);

        const def = matched?.route ?? null;
        const onError: ErrorSink = (error) =>
            this.failure(error, ctx, def, scope);

        const core = async (): Promise<Response> => {
            if (matched === null) {
                const allowed = this.routes.allowedMethods(parts);
                throw allowed.length > 0
                    ? new MethodNotAllowedException(allowed)
                    : new NotFoundException();
            }
            const matchedDef = matched.route;
            return Pipeline.run(
                ctx,
                scope,
                matchedDef.middlewares,
                async () =>
                    toResponse(
                        await invokeHandler(matchedDef.handler, scope, ctx),
                    ),
                onError,
            );
        };

        try {
            return await Pipeline.run(
                ctx,
                scope,
                this.globalMiddlewares,
                core,
                onError,
            );
        } catch (error) {
            return this.failure(error, ctx, def, scope);
        } finally {
            try {
                const disposal = scope.dispose();
                if (disposal) await disposal;
            } catch (error) {
                await this.report(error, ctx);
            }
        }
    }

    private async report(error: unknown, ctx: Context): Promise<void> {
        for (const reporter of this.reporters) {
            try {
                await reporter(error, ctx);
            } catch {}
        }
    }

    private async failure(
        error: unknown,
        ctx: Context,
        def: RouteDefinition | null,
        scope: DiContainer,
    ): Promise<Response> {
        await this.report(error, ctx);
        const renderer = this.resolveRenderer(ctx, def);
        let res: Response;
        try {
            res = toResponse(await this.render(renderer, error, ctx, scope));
        } catch {
            res = new Response('Internal Server Error', { status: 500 });
        }
        if (
            error instanceof MethodNotAllowedException &&
            error.allowed.length > 0
        ) {
            res.headers.set('Allow', error.allowed.join(', '));
        }
        return res;
    }

    private render(
        renderer: ErrorRenderer,
        error: unknown,
        ctx: Context,
        scope: DiContainer,
    ): HandlerResult | Promise<HandlerResult> {
        if (isErrorHandlerClass(renderer)) {
            return scope.get(renderer).render(error, ctx);
        }
        return renderer(error, ctx);
    }

    private resolveRenderer(
        ctx: Context,
        def: RouteDefinition | null,
    ): ErrorRenderer {
        if (def?.renderer) return def.renderer;
        const path = pathnameOf(ctx.req.url);
        let best: PrefixRenderer | null = null;
        for (const entry of this.prefixRenderers) {
            const p = entry.prefix;
            const inScope = p === '/' || path === p || path.startsWith(`${p}/`);
            if (inScope && (best === null || p.length > best.prefix.length)) {
                best = entry;
            }
        }
        return best?.renderer ?? this.renderer ?? defaultErrorRenderer;
    }
}
