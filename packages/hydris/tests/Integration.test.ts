import { describe, expect, it } from 'bun:test';
import { container, Route, router } from '../src/routing/Route';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';

const req = (method: string, path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method,
    } as unknown as globalThis.Request);

describe('handler dependency injection', () => {
    it('injects a registered service into the handler', async () => {
        class Greeter {
            hi(name: string): string {
                return `hi ${name}`;
            }
        }
        container.singleton(Greeter, () => new Greeter());

        class GreetHandler {
            constructor(private readonly greeter: Greeter) {}
            show(ctx: Request): Reply {
                return Reply.text(this.greeter.hi(ctx.param('name') ?? '?'));
            }
        }
        Route.get('/di/greet/:name', [GreetHandler, 'show']);

        const res = await router.dispatch(req('GET', '/di/greet/ada'));
        expect(await res.text()).toBe('hi ada');
    });

    it('injects the request Context into the handler', async () => {
        class CtxHandler {
            constructor(private readonly ctx: Request) {}
            show(): Reply {
                return Reply.text(new URL(this.ctx.url).pathname);
            }
        }
        Route.get('/di/ctx', [CtxHandler, 'show']);

        const res = await router.dispatch(req('GET', '/di/ctx'));
        expect(await res.text()).toBe('/di/ctx');
    });

    it('injects a clean-constructor handler via build-emitted metadata', async () => {
        class Repo {
            all(): string {
                return 'rows';
            }
        }
        container.singleton(Repo, () => new Repo());

        class ListHandler {
            constructor(private readonly repo: Repo) {}
            index(): Reply {
                return Reply.text(this.repo.all());
            }
        }
        Route.get('/di/list', [ListHandler, 'index']);

        const res = await router.dispatch(req('GET', '/di/list'));
        expect(await res.text()).toBe('rows');
    });
});

describe('middleware dependency injection', () => {
    it('injects a registered service into middleware', async () => {
        class Audit {
            paths: string[] = [];
        }
        container.singleton(Audit, () => new Audit());

        class AuditMw extends BaseMiddleware {
            constructor(private readonly audit: Audit) {
                super();
            }
            handle(ctx: Request, next: Next): Promise<Response> {
                this.audit.paths.push(new URL(ctx.url).pathname);
                return next();
            }
        }
        Route.get('/di/audit', () => Reply.text('ok')).middlewares([AuditMw]);

        await router.dispatch(req('GET', '/di/audit'));
        expect(container.get(Audit).paths).toContain('/di/audit');
    });

    it('injects Request into a middleware constructor', async () => {
        const seen: string[] = [];
        class PathMw extends BaseMiddleware {
            constructor(private readonly request: Request) {
                super();
            }
            handle(_ctx: Request, next: Next): Promise<Response> {
                seen.push(new URL(this.request.url).pathname);
                return next();
            }
        }
        Route.get('/di/mwreq', () => Reply.text('ok')).middlewares([PathMw]);

        await router.dispatch(req('GET', '/di/mwreq'));
        expect(seen).toEqual(['/di/mwreq']);
    });
});

describe('request id', () => {
    it('assigns a unique uuid per request, exposed on ctx.id', async () => {
        const ids: string[] = [];
        Route.get('/id', (ctx) => {
            ids.push(ctx.id);
            return Reply.text(ctx.id);
        });

        const a = await (await router.dispatch(req('GET', '/id'))).text();
        const b = await (await router.dispatch(req('GET', '/id'))).text();

        const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        expect(a).toMatch(uuid);
        expect(a).not.toBe(b);
        expect(ids).toEqual([a, b]);
    });
});

describe('body parsing', () => {
    it('parses a typed json body via ctx.json', async () => {
        let parsed: { name: string } | undefined;
        Route.post('/body/json', async (ctx) => {
            parsed = await ctx.json<{ name: string }>();
            return Reply.text(parsed.name);
        });

        const request = new Request(
            new globalThis.Request('http://localhost/body/json', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'ada' }),
            }),
        );

        const res = await router.dispatch(request);
        expect(parsed).toEqual({ name: 'ada' });
        expect(await res.text()).toBe('ada');
    });

    it('parses a text body via ctx.text', async () => {
        Route.post('/body/text', async (ctx) => Reply.text(await ctx.text()));

        const request = new Request(
            new globalThis.Request('http://localhost/body/text', {
                method: 'POST',
                body: 'hello',
            }),
        );

        expect(await (await router.dispatch(request)).text()).toBe('hello');
    });
});

describe('request bag', () => {
    it('gives every request an empty bag by default', async () => {
        let seen: unknown;
        Route.get('/bag/default', (ctx) => {
            seen = ctx.bag;
            return Reply.text('ok');
        });

        await router.dispatch(req('GET', '/bag/default'));
        expect(seen).toEqual({});
    });

    it('carries a typed bag from middleware to handler', async () => {
        interface AuthBag {
            user: string;
        }
        class SetUser extends BaseMiddleware {
            handle(ctx: Request<AuthBag>, next: Next): Promise<Response> {
                ctx.bag.user = 'ada';
                return next();
            }
        }
        class MeHandler {
            show(ctx: Request<AuthBag>): Reply {
                return Reply.text(ctx.bag.user);
            }
        }
        Route.get('/bag/me', [MeHandler, 'show']).middlewares([SetUser]);

        const res = await router.dispatch(req('GET', '/bag/me'));
        expect(await res.text()).toBe('ada');
    });

    it('exposes the bag through ctx.bag', async () => {
        interface CountBag {
            n: number;
        }
        Route.get('/bag/ctx', (ctx: Request<CountBag>) => {
            ctx.bag.n = 7;
            return Reply.text(String(ctx.bag.n));
        });

        const res = await router.dispatch(req('GET', '/bag/ctx'));
        expect(await res.text()).toBe('7');
    });
});

describe('method injection', () => {
    it('injects Request and a service into the handler method', async () => {
        class Logger {
            last = '';
        }
        container.singleton(Logger, () => new Logger());

        class ReqHandler {
            show(request: Request, logger: Logger): Reply {
                const path = new URL(request.url).pathname;
                logger.last = path;
                return Reply.text(path);
            }
        }
        Route.get('/mi/show', [ReqHandler, 'show']);

        const res = await router.dispatch(req('GET', '/mi/show'));
        expect(await res.text()).toBe('/mi/show');
        expect(container.get(Logger).last).toBe('/mi/show');
    });

    it('falls back to passing ctx when a method has no metadata', async () => {
        class PlainHandler {
            show(ctx: Request): Reply {
                return Reply.text(ctx.param('id') ?? 'none');
            }
        }
        Route.get('/mi/plain/:id', [PlainHandler, 'show']);

        const res = await router.dispatch(req('GET', '/mi/plain/7'));
        expect(await res.text()).toBe('7');
    });
});

describe('matched route', () => {
    it('carries the full route info and params on ctx.route', async () => {
        let method = '';
        let path = '';
        let id = '';
        Route.get('/route/users/:id', (ctx) => {
            method = ctx.route?.method ?? '';
            path = ctx.route?.path ?? '';
            id = ctx.route?.param('id') ?? '';
            return Reply.text('ok');
        });

        await router.dispatch(req('GET', '/route/users/42'));
        expect(method).toBe('GET');
        expect(path).toBe('/route/users/:id');
        expect(id).toBe('42');
    });
});

describe('request scope lifecycle', () => {
    it('disposes scoped services after the response', async () => {
        const disposed: string[] = [];
        class ReqLog {
            dispose(): void {
                disposed.push('req');
            }
        }
        container.scoped(ReqLog, () => new ReqLog());

        class ScopedHandler {
            constructor(private readonly log: ReqLog) {}
            show(): Reply {
                void this.log;
                return Reply.text('ok');
            }
        }
        Route.get('/di/scoped', [ScopedHandler, 'show']);

        await router.dispatch(req('GET', '/di/scoped'));
        expect(disposed).toEqual(['req']);
    });
});
