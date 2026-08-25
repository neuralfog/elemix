import { DiContainer } from '../container/DiContainer';
import { CoreServiceProvider } from '../core/CoreServiceProvider';
import { ErrorHandler } from '../error/ErrorHandler';
import {
    DefaultErrorRenderer,
    type ErrorRenderer,
    type ErrorReporter,
} from '../error/ErrorRenderer';
import {
    MethodNotAllowedException,
    NotFoundException,
} from '../error/HttpException';
import { compressDynamic } from '../http/compression';
import { Header, Method } from '../constants';
import { ProxyResolver } from '../http/ProxyResolver';
import { type HandlerResult, toResponse } from '../http/Reply';
import type { Request } from '../http/Request';
import type { Middleware } from '../middleware/Middleware';
import { type ErrorSink, Pipeline } from '../middleware/Pipeline';
import { type Handler, HandlerDispatcher } from './HandlerDispatcher';
import { MatchedRoute } from './MatchedRoute';
import { RouteCollection } from './RouteCollection';
import { RouteDefinition } from './RouteDefinition';

type PrefixRenderer = {
    prefix: string;
    renderer: ErrorRenderer;
};

type NamedGroup = {
    routes: RouteDefinition[];
    prefix: string;
};

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
        new CoreServiceProvider().register(this.container);
    }

    private static pathnameOf(url: string): string {
        const start = url.indexOf('/', url.indexOf('://') + 3);
        if (start === -1) return '/';
        const query = url.indexOf('?', start);
        return query === -1 ? url.slice(start) : url.slice(start, query);
    }

    private static isSkipped(entry: Middleware, skip: Middleware[]): boolean {
        return skip.some(
            (s) =>
                s === entry || (typeof s === 'function' && entry instanceof s),
        );
    }

    private static callerFile(): string | null {
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
        const file = this.pendingFile ?? Router.callerFile();
        if (file !== null) this.nameGroup(file, [route], '/');
        return route;
    }

    registerStatic(path: string, handler: Handler): RouteDefinition {
        return this.routes.add(Method.Get, path, handler, true);
    }

    async dispatch(
        req: Request,
        socketIp = '',
        trustProxy = false,
    ): Promise<Response> {
        const parts = RouteDefinition.segmentsOf(Router.pathnameOf(req.url));
        const matched = this.routes.match(req.method as Method, parts);
        req.route = matched
            ? new MatchedRoute(matched.route, matched.params)
            : null;

        if (matched?.route.isStatic) {
            try {
                return toResponse(
                    await HandlerDispatcher.invoke(
                        matched.route.handler,
                        this.container,
                        req,
                    ),
                    req,
                );
            } catch (error) {
                return this.failure(error, req, matched.route, this.container);
            }
        }

        req.id = Bun.randomUUIDv7();
        req.ip = ProxyResolver.resolveIp(req, socketIp, trustProxy);
        req.protocol = ProxyResolver.resolveProtocol(req, trustProxy);

        const scope = CoreServiceProvider.requestScope(this.container, req);

        const def = matched?.route ?? null;
        const onError: ErrorSink = (error) =>
            this.failure(error, req, def, scope);

        const core = async (): Promise<Response> => {
            if (matched === null) {
                const allowed = this.routes.allowedMethods(parts);
                throw allowed.length > 0
                    ? new MethodNotAllowedException(allowed)
                    : new NotFoundException();
            }
            const matchedDef = matched.route;
            return Pipeline.run(
                req,
                scope,
                matchedDef.middlewares,
                async () =>
                    toResponse(
                        await HandlerDispatcher.invoke(
                            matchedDef.handler,
                            scope,
                            req,
                        ),
                        req,
                    ),
                onError,
            );
        };

        const globals =
            def !== null && def.skip.length > 0
                ? this.globalMiddlewares.filter(
                      (m) => !Router.isSkipped(m, def.skip),
                  )
                : this.globalMiddlewares;

        try {
            return await compressDynamic(
                await Pipeline.run(req, scope, globals, core, onError),
                req,
            );
        } catch (error) {
            return compressDynamic(
                await this.failure(error, req, def, scope),
                req,
            );
        } finally {
            try {
                const disposal = scope.dispose();
                if (disposal) await disposal;
            } catch (error) {
                await this.report(error, req);
            }
        }
    }

    private async report(error: unknown, req: Request): Promise<void> {
        if (this.reporters.length === 0) {
            if (DefaultErrorRenderer.status(error) >= 500) console.error(error);
            return;
        }
        for (const reporter of this.reporters) {
            try {
                await reporter(error, req);
            } catch {}
        }
    }

    private async failure(
        error: unknown,
        req: Request,
        def: RouteDefinition | null,
        scope: DiContainer,
    ): Promise<Response> {
        await this.report(error, req);
        const renderer = this.resolveRenderer(req, def);
        let res: Response;
        try {
            res = toResponse(
                await this.render(renderer, error, req, scope),
                req,
            );
        } catch {
            res = new Response('Internal Server Error', { status: 500 });
        }
        if (
            error instanceof MethodNotAllowedException &&
            error.allowed.length > 0
        ) {
            res.headers.set(Header.Allow, error.allowed.join(', '));
        }
        return res;
    }

    private render(
        renderer: ErrorRenderer,
        error: unknown,
        req: Request,
        scope: DiContainer,
    ): HandlerResult | Promise<HandlerResult> {
        if (ErrorHandler.isClass(renderer)) {
            return scope.get(renderer).render(error, req);
        }
        return renderer(error, req);
    }

    private resolveRenderer(
        req: Request,
        def: RouteDefinition | null,
    ): ErrorRenderer {
        if (def?.renderer) return def.renderer;
        const path = Router.pathnameOf(req.url);
        let best: PrefixRenderer | null = null;
        for (const entry of this.prefixRenderers) {
            const p = entry.prefix;
            const inScope = p === '/' || path === p || path.startsWith(`${p}/`);
            if (inScope && (best === null || p.length > best.prefix.length)) {
                best = entry;
            }
        }
        return best?.renderer ?? this.renderer ?? DefaultErrorRenderer.render;
    }
}
