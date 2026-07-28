import { describe, expect, it } from 'bun:test';
import { App } from '../src/App';
import { Context } from '../src/http/Context';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { Route, router } from '../src/routing/Route';
import { Router } from '../src/routing/Router';

const req = (method: string, path: string): Request =>
    ({ url: `http://localhost${path}`, method }) as unknown as Request;

describe('global middlewares', () => {
    it('runs a registered global middleware for every route', async () => {
        const r = new Router();
        const hits: string[] = [];
        class Global extends BaseMiddleware {
            handle(ctx: Context, next: Next): Promise<Response> {
                hits.push(new URL(ctx.req.url).pathname);
                return next();
            }
        }
        r.use([Global]);
        r.register('GET', '/a', () => Reply.text('a'));
        r.register('GET', '/b', () => Reply.text('b'));

        await r.dispatch(req('GET', '/a'));
        await r.dispatch(req('GET', '/b'));
        expect(hits).toEqual(['/a', '/b']);
    });

    it('runs global middlewares outermost, before route middlewares', async () => {
        const r = new Router();
        const order: string[] = [];
        class Outer extends BaseMiddleware {
            async handle(_ctx: Context, next: Next): Promise<Response> {
                order.push('global:before');
                const res = await next();
                order.push('global:after');
                return res;
            }
        }
        class Inner extends BaseMiddleware {
            async handle(_ctx: Context, next: Next): Promise<Response> {
                order.push('route:before');
                const res = await next();
                order.push('route:after');
                return res;
            }
        }
        r.use([Outer]);
        const wrap = r.register('GET', '/wrap', () => {
            order.push('handler');
            return Reply.text('ok');
        });
        wrap.middlewares.push(Inner);

        await r.dispatch(req('GET', '/wrap'));
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
            handle(ctx: Context, next: Next): Promise<Response> | Response {
                hits.push(ctx.req.method);
                if (ctx.req.method === 'OPTIONS') {
                    return new Response(null, { status: 204 });
                }
                return next();
            }
        }
        r.use([Preflight]);
        r.register('GET', '/thing', () => Reply.text('ok'));

        const pre = await r.dispatch(req('OPTIONS', '/thing'));
        expect(pre.status).toBe(204);
        expect(hits).toEqual(['OPTIONS']);
    });

    it('runs global middlewares on an unmatched path, then 404s', async () => {
        const r = new Router();
        let ran = false;
        class Mark extends BaseMiddleware {
            handle(_ctx: Context, next: Next): Promise<Response> {
                ran = true;
                return next();
            }
        }
        r.use([Mark]);

        const res = await r.dispatch(req('GET', '/nope'));
        expect(res.status).toBe(404);
        expect(ran).toBe(true);
    });

    it('App.middlewares registers a global middleware on the app router', async () => {
        const seen: string[] = [];
        class Track extends BaseMiddleware {
            handle(ctx: Context, next: Next): Promise<Response> {
                seen.push(new URL(ctx.req.url).pathname);
                return next();
            }
        }
        App.middlewares([Track]);
        Route.get('/global/app', () => Reply.text('ok'));

        await router.dispatch(req('GET', '/global/app'));
        expect(seen).toContain('/global/app');
    });
});
