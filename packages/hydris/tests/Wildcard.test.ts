import { describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';
import { Request } from '../src/http/Request';
import { RouteCollection } from '../src/routing/RouteCollection';
import { Route, router } from '../src/routing/Route';

type AddHandler = Parameters<RouteCollection['add']>[2];
const noop = (() => new Response('ok')) as unknown as AddHandler;
const parts = (path: string): string[] => path.split('/').filter(Boolean);
const request = (path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method: 'GET',
        headers: new Headers(),
    } as unknown as globalThis.Request);

describe('wildcard route matching', () => {
    it('matches the base and captures the rest under *', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/home/*', noop);
        expect(routes.match('GET', parts('/home/a'))?.params['*']).toBe('a');
        expect(routes.match('GET', parts('/home/a/b/c'))?.params['*']).toBe(
            'a/b/c',
        );
        expect(routes.match('GET', parts('/home'))?.params['*']).toBe('');
    });

    it('does not match a different prefix', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/home/*', noop);
        expect(routes.match('GET', parts('/about/x'))).toBeNull();
    });

    it('prefers an exact route over the wildcard', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/home/*', noop);
        const exact = routes.add('GET', '/home/settings', noop);
        expect(routes.match('GET', parts('/home/settings'))?.route).toBe(exact);
    });

    it('prefers a param route over the wildcard', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/home/*', noop);
        const param = routes.add('GET', '/home/:id', noop);
        const match = routes.match('GET', parts('/home/42'));
        expect(match?.route).toBe(param);
        expect(match?.params.id).toBe('42');
    });

    it('decodes wildcard segments', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/files/*', noop);
        expect(routes.match('GET', parts('/files/a%20b/c'))?.params['*']).toBe(
            'a b/c',
        );
    });
});

describe('wildcard combined with route params', () => {
    it('captures named params and the wildcard tail together', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/users/:id/files/*', noop);
        const match = routes.match(
            'GET',
            parts('/users/42/files/docs/report.pdf'),
        );
        expect(match?.params.id).toBe('42');
        expect(match?.params['*']).toBe('docs/report.pdf');
    });

    it('handles a wildcard immediately after a param', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/users/:id/*', noop);
        const match = routes.match('GET', parts('/users/7/a/b'));
        expect(match?.params.id).toBe('7');
        expect(match?.params['*']).toBe('a/b');
    });

    it('captures multiple params before the wildcard', () => {
        const routes = new RouteCollection();
        routes.add('GET', '/:org/:repo/tree/*', noop);
        const match = routes.match(
            'GET',
            parts('/neuralfog/elemix/tree/packages/hydris'),
        );
        expect(match?.params.org).toBe('neuralfog');
        expect(match?.params.repo).toBe('elemix');
        expect(match?.params['*']).toBe('packages/hydris');
    });
});

describe('wildcard through the router', () => {
    it('exposes the captured rest via ctx.param("*")', async () => {
        Route.get('/assets/*', (ctx) => Reply.text(ctx.param('*') ?? 'none'));
        const res = await router.dispatch(request('/assets/img/logo.png'));
        expect(await res.text()).toBe('img/logo.png');
    });

    it('exposes params and wildcard together via ctx', async () => {
        Route.get('/u/:id/rest/*', (ctx) =>
            Reply.json({ id: ctx.param('id'), rest: ctx.param('*') }),
        );
        const res = await router.dispatch(request('/u/9/rest/x/y'));
        expect(await res.json()).toEqual({ id: '9', rest: 'x/y' });
    });
});
