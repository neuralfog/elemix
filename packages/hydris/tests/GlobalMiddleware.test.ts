import { describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { App } from '../src/App';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { Route, router } from '../src/routing/Route';
import { Router } from '../src/routing/Router';

const req = (method: string, path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method,
    } as unknown as globalThis.Request);

describe('global middlewares', () => {
    it('runs a registered global middleware for every route', async () => {
        const r = new Router();
        const hits: string[] = [];
        class Global extends BaseMiddleware {
            handle(ctx: Request, next: Next): Promise<Response> {
                hits.push(new URL(ctx.url).pathname);
                return next();
            }
        }
        r.use([Global]);
        r.register(Method.Get, '/a', () => Reply.text('a'));
        r.register(Method.Get, '/b', () => Reply.text('b'));

        await r.dispatch(req(Method.Get, '/a'));
        await r.dispatch(req(Method.Get, '/b'));
        expect(hits).toEqual(['/a', '/b']);
    });

    it('runs global middlewares outermost, before route middlewares', async () => {
        const r = new Router();
        const order: string[] = [];
        class Outer extends BaseMiddleware {
            async handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('global:before');
                const res = await next();
                order.push('global:after');
                return res;
            }
        }
        class Inner extends BaseMiddleware {
            async handle(_ctx: Request, next: Next): Promise<Response> {
                order.push('route:before');
                const res = await next();
                order.push('route:after');
                return res;
            }
        }
        r.use([Outer]);
        const wrap = r.register(Method.Get, '/wrap', () => {
            order.push('handler');
            return Reply.text('ok');
        });
        wrap.middlewares.push(Inner);

        await r.dispatch(req(Method.Get, '/wrap'));
        expect(order).toEqual([
            'global:before',
            'route:before',
            'handler',
            'route:after',
            'global:after',
        ]);
    });

    it('runs global middlewares even when no route matches, letting one short-circuit', async () => {
        const r = new Router();
        const hits: string[] = [];
        class Preflight extends BaseMiddleware {
            handle(ctx: Request, next: Next): Promise<Response> | Response {
                hits.push(ctx.method);
                if (ctx.method === Method.Options) {
                    return new Response(null, { status: 204 });
                }
                return next();
            }
        }
        r.use([Preflight]);
        r.register(Method.Get, '/thing', () => Reply.text('ok'));

        const pre = await r.dispatch(req(Method.Options, '/thing'));
        expect(pre.status).toBe(204);
        expect(hits).toEqual([Method.Options]);
    });

    it('runs global middlewares on an unmatched path, then 404s', async () => {
        const r = new Router();
        let ran = false;
        class Mark extends BaseMiddleware {
            handle(_ctx: Request, next: Next): Promise<Response> {
                ran = true;
                return next();
            }
        }
        r.use([Mark]);

        const res = await r.dispatch(req(Method.Get, '/nope'));
        expect(res.status).toBe(404);
        expect(ran).toBe(true);
    });

    it('App.middlewares registers a global middleware on the app router', async () => {
        const seen: string[] = [];
        class Track extends BaseMiddleware {
            handle(ctx: Request, next: Next): Promise<Response> {
                seen.push(new URL(ctx.url).pathname);
                return next();
            }
        }
        App.middlewares([Track]);
        Route.get('/global/app', () => Reply.text('ok'));

        await router.dispatch(req(Method.Get, '/global/app'));
        expect(seen).toContain('/global/app');
    });
});
