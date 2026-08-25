import { describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { DiContainer } from '../src/container/DiContainer';
import { ErrorHandler } from '../src/error/ErrorHandler';
import { NotFoundException } from '../src/error/HttpException';
import { DefaultErrorRenderer } from '../src/error/ErrorRenderer';
import { Reply } from '../src/http/Reply';
import { Request } from '../src/http/Request';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Router } from '../src/routing/Router';

const req = (
    method: string,
    path: string,
    headers?: Record<string, string>,
): Request =>
    new Request({
        url: `http://localhost${path}`,
        method,
        headers: new Headers(headers),
    } as unknown as globalThis.Request);

describe('error boundary', () => {
    it('renders an unexpected throw as 500 without leaking the message', async () => {
        const r = new Router();
        r.register(Method.Get, '/boom', () => {
            throw new Error('kaboom secret');
        });

        const res = await r.dispatch(req(Method.Get, '/boom'));
        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain('kaboom');
    });

    it('maps an HttpException to its status and shows its message', async () => {
        const r = new Router();
        r.register(Method.Get, '/missing', () => {
            throw new NotFoundException('no such user');
        });

        const res = await r.dispatch(req(Method.Get, '/missing'));
        expect(res.status).toBe(404);
        expect(await res.text()).toContain('no such user');
    });

    it('renders an unmatched route as a 404 through the error path', async () => {
        const r = new Router();
        const res = await r.dispatch(req(Method.Get, '/nope'));
        expect(res.status).toBe(404);
    });
});

describe('content negotiation', () => {
    it('returns json when the client accepts json', async () => {
        const r = new Router();
        r.register(Method.Get, '/j', () => {
            throw new NotFoundException('gone');
        });

        const res = await r.dispatch(
            req(Method.Get, '/j', { accept: 'application/json' }),
        );
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ error: 'gone', status: 404 });
    });

    it('returns an html page by default', async () => {
        const r = new Router();
        r.register(Method.Get, '/j', () => {
            throw new NotFoundException('gone');
        });

        const res = await r.dispatch(req(Method.Get, '/j'));
        expect(res.headers.get('content-type')).toContain('text/html');
    });
});

describe('custom renderers', () => {
    it('uses a registered global renderer', async () => {
        const r = new Router();
        r.renderError((error) =>
            Reply.text(`custom:${DefaultErrorRenderer.status(error)}`).status(
                DefaultErrorRenderer.status(error),
            ),
        );
        r.register(Method.Get, '/x', () => {
            throw new NotFoundException();
        });

        const res = await r.dispatch(req(Method.Get, '/x'));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('custom:404');
    });

    it('lets a route renderer override the global one', async () => {
        const r = new Router();
        r.renderError(() => Reply.text('global'));
        const def = r.register(Method.Get, '/api/thing', () => {
            throw new Error('x');
        });
        def.renderer = (error) =>
            Reply.json({
                scoped: true,
                status: DefaultErrorRenderer.status(error),
            }).status(DefaultErrorRenderer.status(error));
        r.register(Method.Get, '/web/thing', () => {
            throw new Error('y');
        });

        const api = await r.dispatch(req(Method.Get, '/api/thing'));
        expect(await api.json()).toEqual({ scoped: true, status: 500 });

        const web = await r.dispatch(req(Method.Get, '/web/thing'));
        expect(await web.text()).toBe('global');
    });
});

describe('prefix-scoped renderers', () => {
    it('renders a 404 under a group prefix with the group renderer', async () => {
        const r = new Router();
        r.renderErrorFor('/api', (error) =>
            Reply.json({
                api: true,
                status: DefaultErrorRenderer.status(error),
            }).status(DefaultErrorRenderer.status(error)),
        );

        const res = await r.dispatch(req(Method.Get, '/api/test/hdshd'));
        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ api: true, status: 404 });
    });

    it('leaves paths outside the prefix on the default renderer', async () => {
        const r = new Router();
        r.renderErrorFor('/api', () => Reply.json({ api: true }));

        const res = await r.dispatch(req(Method.Get, '/web/nope'));
        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('text/html');
    });

    it('matches on segment boundaries, not raw string prefix', async () => {
        const r = new Router();
        r.renderErrorFor('/api', () => Reply.json({ api: true }));

        const res = await r.dispatch(req(Method.Get, '/apidocs/x'));
        expect(res.headers.get('content-type')).toContain('text/html');
    });

    it('lets the longest matching prefix win', async () => {
        const r = new Router();
        r.renderErrorFor('/api', () => Reply.text('api'));
        r.renderErrorFor('/api/v2', () => Reply.text('v2'));

        expect(
            await (await r.dispatch(req(Method.Get, '/api/v2/x'))).text(),
        ).toBe('v2');
        expect(await (await r.dispatch(req(Method.Get, '/api/x'))).text()).toBe(
            'api',
        );
    });

    it('treats a "/" prefix as the fallback, beaten by longer prefixes', async () => {
        const r = new Router();
        r.renderErrorFor('/', () => Reply.text('web'));
        r.renderErrorFor('/api/test', () => Reply.json({ api: true }));

        expect(await (await r.dispatch(req(Method.Get, '/nope'))).text()).toBe(
            'web',
        );
        const api = await r.dispatch(req(Method.Get, '/api/test/x'));
        expect(await api.json()).toEqual({ api: true });
    });
});

describe('error resilience', () => {
    it('renders a middleware-thrown error back through outer middleware', async () => {
        const r = new Router();
        const order: string[] = [];
        class Outer extends BaseMiddleware {
            async handle(_ctx: unknown, next: Next): Promise<Response> {
                order.push('outer:before');
                const res = await next();
                order.push('outer:after');
                res.headers.set('x-outer', 'seen');
                return res;
            }
        }
        class Boom extends BaseMiddleware {
            handle(): Response {
                throw new Error('mw boom');
            }
        }
        const route = r.register(Method.Get, '/x', () => Reply.text('ok'));
        route.middlewares.push(Outer, Boom);

        const res = await r.dispatch(req(Method.Get, '/x'));
        expect(res.status).toBe(500);
        expect(res.headers.get('x-outer')).toBe('seen');
        expect(order).toEqual(['outer:before', 'outer:after']);
    });

    it('reports a disposal error without clobbering the response', async () => {
        const r = new Router();
        const reported: unknown[] = [];
        r.onError((error) => {
            reported.push(error);
        });
        class BadDispose {
            dispose(): void {
                throw new Error('dispose boom');
            }
        }
        r.container.scoped(BadDispose, () => new BadDispose());
        class Handler {
            constructor(public dep: BadDispose) {}
            show(): Reply {
                void this.dep;
                return Reply.text('fine');
            }
        }
        DiContainer.inject(Handler, [BadDispose]);
        r.register(Method.Get, '/ok', [Handler, 'show']);

        const res = await r.dispatch(req(Method.Get, '/ok'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('fine');
        expect(reported).toHaveLength(1);
        expect((reported[0] as Error).message).toBe('dispose boom');
    });
});

describe('named group renderers', () => {
    it('renders errors for a named group by name', async () => {
        const r = new Router();
        const route = r.register(Method.Get, '/n/x', () => Reply.text('ok'));
        r.nameGroup('mygroup', [route], '/');
        r.renderErrorForName('mygroup', () => Reply.text('named').status(404));

        const res = await r.dispatch(req(Method.Get, '/n/x/deep'));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('named');
    });

    it('throws for an unknown named group', () => {
        const r = new Router();
        expect(() =>
            r.renderErrorForName('nope', () => Reply.text('x')),
        ).toThrow('No route group named "nope"');
    });
});

describe('class-based error handlers', () => {
    it('resolves an ErrorHandler class via DI for a prefix', async () => {
        class ApiErrors extends ErrorHandler {
            render(error: unknown): Reply {
                return Reply.json({
                    handled: true,
                    status: DefaultErrorRenderer.status(error),
                }).status(DefaultErrorRenderer.status(error));
            }
        }
        const r = new Router();
        r.renderErrorFor('/api', ApiErrors);

        const res = await r.dispatch(req(Method.Get, '/api/x'));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ handled: true, status: 404 });
    });

    it('accepts a class as the global renderer', async () => {
        class Errs extends ErrorHandler {
            render(error: unknown): Reply {
                return Reply.text(
                    `E${DefaultErrorRenderer.status(error)}`,
                ).status(DefaultErrorRenderer.status(error));
            }
        }
        const r = new Router();
        r.renderError(Errs);
        r.register(Method.Get, '/x', () => {
            throw new NotFoundException();
        });

        const res = await r.dispatch(req(Method.Get, '/x'));
        expect(await res.text()).toBe('E404');
    });
});

describe('reporters', () => {
    it('reports the error with the context', async () => {
        const r = new Router();
        const seen: unknown[] = [];
        r.onError((error) => {
            seen.push(error);
        });
        r.register(Method.Get, '/boom', () => {
            throw new Error('logged');
        });

        await r.dispatch(req(Method.Get, '/boom'));
        expect(seen).toHaveLength(1);
        expect((seen[0] as Error).message).toBe('logged');
    });

    it('still renders when a reporter throws', async () => {
        const r = new Router();
        r.onError(() => {
            throw new Error('reporter blew up');
        });
        r.register(Method.Get, '/ok', () => {
            throw new NotFoundException();
        });

        const res = await r.dispatch(req(Method.Get, '/ok'));
        expect(res.status).toBe(404);
    });
});

describe('meta fallback', () => {
    it('falls back to a bare 500 when the renderer itself throws', async () => {
        const r = new Router();
        r.renderError(() => {
            throw new Error('renderer broke');
        });
        r.register(Method.Get, '/z', () => {
            throw new NotFoundException();
        });

        const res = await r.dispatch(req(Method.Get, '/z'));
        expect(res.status).toBe(500);
        expect(await res.text()).toBe('Internal Server Error');
    });
});
