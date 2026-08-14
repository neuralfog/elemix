import { describe, expect, it } from 'bun:test';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { Route, router } from '../src/routing/Route';

const req = (method: string, path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method,
    } as unknown as globalThis.Request);

describe('route middlewares', () => {
    it('runs before and after the handler in onion order', async () => {
        const order: string[] = [];
        class A extends BaseMiddleware {
            async handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('a:before');
                const res = await next();
                order.push('a:after');
                return res;
            }
        }
        class B extends BaseMiddleware {
            async handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('b:before');
                const res = await next();
                order.push('b:after');
                return res;
            }
        }
        Route.get('/mw/order', () => {
            order.push('handler');
            return Reply.text('ok');
        }).middlewares([A, B]);

        const res = await router.dispatch(req('GET', '/mw/order'));
        expect(await res.text()).toBe('ok');
        expect(order).toEqual([
            'a:before',
            'b:before',
            'handler',
            'b:after',
            'a:after',
        ]);
    });

    it('short-circuits when a middleware does not call next', async () => {
        let handlerRan = false;
        class Deny extends BaseMiddleware {
            handle(): Response {
                return new Response('denied', { status: 403 });
            }
        }
        Route.get('/mw/guard', () => {
            handlerRan = true;
            return Reply.text('secret');
        }).middlewares([Deny]);

        const res = await router.dispatch(req('GET', '/mw/guard'));
        expect(res.status).toBe(403);
        expect(await res.text()).toBe('denied');
        expect(handlerRan).toBe(false);
    });

    it('lets a middleware rewrite the downstream response', async () => {
        class Wrap extends BaseMiddleware {
            async handle(_ctx: Request, next: Next): Promise<Response> {
                const res = await next();
                return new Response(`[${await res.text()}]`, {
                    status: res.status,
                });
            }
        }
        Route.get('/mw/rewrite', () => Reply.text('inner')).middlewares([Wrap]);

        expect(
            await (await router.dispatch(req('GET', '/mw/rewrite'))).text(),
        ).toBe('[inner]');
    });

    it('chains additional middlewares in call order', async () => {
        const order: string[] = [];
        class First extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('first');
                return next();
            }
        }
        class Second extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('second');
                return next();
            }
        }
        Route.get('/mw/chain', () => Reply.text('ok'))
            .middlewares([First])
            .middlewares([Second]);

        await router.dispatch(req('GET', '/mw/chain'));
        expect(order).toEqual(['first', 'second']);
    });

    it('instantiates a fresh middleware per request', async () => {
        const seen: number[] = [];
        let created = 0;
        class Counting extends BaseMiddleware {
            private readonly id = ++created;
            handle(_ctx: Request, next: Next): Promise<Response> {
                seen.push(this.id);
                return next();
            }
        }
        Route.get('/mw/fresh', () => Reply.text('ok')).middlewares([Counting]);

        await router.dispatch(req('GET', '/mw/fresh'));
        await router.dispatch(req('GET', '/mw/fresh'));
        expect(seen).toEqual([1, 2]);
    });
});

describe('group middlewares', () => {
    it('applies to every route in the group', async () => {
        const hits: string[] = [];
        class Track extends BaseMiddleware {
            handle(ctx: Request, next: Next): Promise<Response> {
                hits.push(new URL(ctx.url).pathname);
                return next();
            }
        }
        Route.group('/g', () => {
            Route.get('/a', () => Reply.text('a'));
            Route.get('/b', () => Reply.text('b'));
        }).middlewares([Track]);

        await router.dispatch(req('GET', '/g/a'));
        await router.dispatch(req('GET', '/g/b'));
        expect(hits).toEqual(['/g/a', '/g/b']);
    });

    it('runs group middlewares before route middlewares', async () => {
        const order: string[] = [];
        class Group extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('group');
                return next();
            }
        }
        class RouteMw extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('route');
                return next();
            }
        }
        Route.group('/wrap', () => {
            Route.get('/x', () => Reply.text('x')).middlewares([RouteMw]);
        }).middlewares([Group]);

        await router.dispatch(req('GET', '/wrap/x'));
        expect(order).toEqual(['group', 'route']);
    });

    it('nests group middlewares outermost-first', async () => {
        const order: string[] = [];
        class Api extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('api');
                return next();
            }
        }
        class V2 extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('v2');
                return next();
            }
        }
        class RouteMw extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('route');
                return next();
            }
        }
        Route.group('/mwnest', () => {
            Route.group('/v2', () => {
                Route.get('/ping', () => Reply.text('pong')).middlewares([
                    RouteMw,
                ]);
            }).middlewares([V2]);
        }).middlewares([Api]);

        await router.dispatch(req('GET', '/mwnest/v2/ping'));
        expect(order).toEqual(['api', 'v2', 'route']);
    });
});
