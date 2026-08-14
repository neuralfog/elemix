import { describe, expect, it } from 'bun:test';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { Router } from '../src/routing/Router';

const get = (path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method: 'GET',
    } as unknown as globalThis.Request);

describe('Router dispatch', () => {
    it('returns an html response', async () => {
        const router = new Router();
        router.register('GET', '/hello', () => Reply.html('hi there'));

        const res = await router.dispatch(get('/hello'));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(await res.text()).toBe('hi there');
    });

    it('returns a json response', async () => {
        const router = new Router();
        router.register('GET', '/data', () => Reply.json({ ok: true, n: 1 }));

        const res = await router.dispatch(get('/data'));
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ ok: true, n: 1 });
    });

    it('applies a chosen status', async () => {
        const router = new Router();
        router.register('GET', '/made', () => Reply.text('made').status(201));

        const res = await router.dispatch(get('/made'));
        expect(res.status).toBe(201);
        expect(await res.text()).toBe('made');
    });

    it('passes a native Response through untouched', async () => {
        const router = new Router();
        const sentinel = new Response('teapot', { status: 418 });
        router.register('GET', '/raw', () => sentinel);

        const res = await router.dispatch(get('/raw'));
        expect(res.status).toBe(418);
        expect(await res.text()).toBe('teapot');
    });

    it('awaits an async handler', async () => {
        const router = new Router();
        router.register('GET', '/async', async () => {
            await Promise.resolve();
            return Reply.text('done');
        });

        expect(await (await router.dispatch(get('/async'))).text()).toBe(
            'done',
        );
    });

    it('404s an unknown path', async () => {
        const router = new Router();
        const res = await router.dispatch(get('/nope'));
        expect(res.status).toBe(404);
    });

    it('405s a method mismatch with an Allow header', async () => {
        const router = new Router();
        router.register('POST', '/hello', () => Reply.text('hi'));
        router.register('PUT', '/hello', () => Reply.text('hi'));

        const res = await router.dispatch(get('/hello'));
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('POST, PUT');
    });
});

describe('dynamic params', () => {
    it('captures a single param into the context', async () => {
        const router = new Router();
        router.register('GET', '/hello/:id', (ctx) =>
            Reply.text(`id=${ctx.params.id}`),
        );

        expect(await (await router.dispatch(get('/hello/42'))).text()).toBe(
            'id=42',
        );
    });

    it('captures multiple params', async () => {
        const router = new Router();
        router.register('GET', '/u/:user/post/:post', (ctx) =>
            Reply.text(`${ctx.params.user}:${ctx.params.post}`),
        );

        expect(await (await router.dispatch(get('/u/ada/post/7'))).text()).toBe(
            'ada:7',
        );
    });

    it('captures adjacent params', async () => {
        const router = new Router();
        router.register('GET', '/:year/:month/:day', (ctx) =>
            Reply.text(
                `${ctx.params.year}-${ctx.params.month}-${ctx.params.day}`,
            ),
        );

        expect(await (await router.dispatch(get('/2026/07/24'))).text()).toBe(
            '2026-07-24',
        );
    });

    it('captures params bookended by static segments', async () => {
        const router = new Router();
        router.register('GET', '/api/:version/users/:id/posts', (ctx) =>
            Reply.text(`${ctx.params.version}/${ctx.params.id}`),
        );

        expect(
            await (await router.dispatch(get('/api/v2/users/99/posts'))).text(),
        ).toBe('v2/99');
    });

    it('decodes each param independently', async () => {
        const router = new Router();
        router.register('GET', '/:a/:b', (ctx) =>
            Reply.text(`${ctx.params.a}|${ctx.params.b}`),
        );

        expect(await (await router.dispatch(get('/a%20b/c%2Fd'))).text()).toBe(
            'a b|c/d',
        );
    });

    it('decodes percent-encoded segments', async () => {
        const router = new Router();
        router.register('GET', '/hello/:name', (ctx) =>
            Reply.text(ctx.params.name),
        );

        expect(await (await router.dispatch(get('/hello/a%20b'))).text()).toBe(
            'a b',
        );
    });

    it('does not match when the segment count differs', async () => {
        const router = new Router();
        router.register('GET', '/hello/:id', () => Reply.text('hit'));

        expect((await router.dispatch(get('/hello'))).status).toBe(404);
        expect((await router.dispatch(get('/hello/1/2'))).status).toBe(404);
    });

    it('normalizes a trailing slash', async () => {
        const router = new Router();
        router.register('GET', '/hello/:id', (ctx) =>
            Reply.text(ctx.params.id),
        );

        expect(await (await router.dispatch(get('/hello/9/'))).text()).toBe(
            '9',
        );
    });
});

describe('static beats param', () => {
    it('prefers a static segment when the param is registered first', async () => {
        const router = new Router();
        router.register('GET', '/test/:id', (ctx) =>
            Reply.text(`id=${ctx.params.id}`),
        );
        router.register('GET', '/test/new', () => Reply.text('new'));

        expect(await (await router.dispatch(get('/test/new'))).text()).toBe(
            'new',
        );
    });

    it('prefers a static segment when the param is registered last', async () => {
        const router = new Router();
        router.register('GET', '/test/new', () => Reply.text('new'));
        router.register('GET', '/test/:id', (ctx) =>
            Reply.text(`id=${ctx.params.id}`),
        );

        expect(await (await router.dispatch(get('/test/new'))).text()).toBe(
            'new',
        );
    });

    it('still falls through to the param for other values', async () => {
        const router = new Router();
        router.register('GET', '/test/:id', (ctx) =>
            Reply.text(`id=${ctx.params.id}`),
        );
        router.register('GET', '/test/new', () => Reply.text('new'));

        expect(await (await router.dispatch(get('/test/42'))).text()).toBe(
            'id=42',
        );
    });
});

describe('registration order', () => {
    it('serves the first defined route on an identical static collision', async () => {
        const router = new Router();
        router.register('GET', '/test/new', () => Reply.text('first'));
        router.register('GET', '/test/new', () => Reply.text('second'));

        expect(await (await router.dispatch(get('/test/new'))).text()).toBe(
            'first',
        );
    });

    it('serves the first defined route on an identical param collision', async () => {
        const router = new Router();
        router.register('GET', '/test/:id', () => Reply.text('first'));
        router.register('GET', '/test/:slug', () => Reply.text('second'));

        expect(await (await router.dispatch(get('/test/42'))).text()).toBe(
            'first',
        );
    });
});

describe('Request', () => {
    it('passes the request through and exposes a param accessor', async () => {
        const router = new Router();
        let seen: Request | undefined;
        router.register('GET', '/x/:id', (ctx) => {
            seen = ctx;
            return Reply.text(ctx.param('id') ?? 'none');
        });

        const req = get('/x/5');
        const res = await router.dispatch(req);
        expect(await res.text()).toBe('5');
        expect(seen).toBe(req);
        expect(seen?.param('missing')).toBeUndefined();
    });
});
