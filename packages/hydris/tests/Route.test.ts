import { describe, expect, it } from 'bun:test';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { Route, router } from '../src/routing/Route';

const req = (method: string, path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method,
    } as unknown as globalThis.Request);

describe('Route facade', () => {
    it('registers each verb on the shared router', async () => {
        Route.get('/facade/get', () => Reply.text('g'));
        Route.head('/facade/head', () => Reply.text('h'));
        Route.post('/facade/post', () => Reply.text('p'));
        Route.put('/facade/put', () => Reply.text('pu'));
        Route.patch('/facade/patch', () => Reply.text('pa'));
        Route.delete('/facade/delete', () => Reply.text('d'));
        Route.connect('/facade/connect', () => Reply.text('c'));
        Route.options('/facade/options', () => Reply.text('o'));
        Route.trace('/facade/trace', () => Reply.text('t'));

        const cases: [string, string, string][] = [
            ['GET', '/facade/get', 'g'],
            ['HEAD', '/facade/head', 'h'],
            ['POST', '/facade/post', 'p'],
            ['PUT', '/facade/put', 'pu'],
            ['PATCH', '/facade/patch', 'pa'],
            ['DELETE', '/facade/delete', 'd'],
            ['CONNECT', '/facade/connect', 'c'],
            ['OPTIONS', '/facade/options', 'o'],
            ['TRACE', '/facade/trace', 't'],
        ];

        for (const [method, path, body] of cases) {
            const res = await router.dispatch(req(method, path));
            expect(res.status).toBe(200);
            expect(await res.text()).toBe(body);
        }
    });

    it('routes a class handler by instance method reference', async () => {
        class HelloHandler {
            show(): Reply {
                return Reply.text('from handler');
            }
        }
        Route.get('/facade/handler', [HelloHandler, 'show']);

        const res = await router.dispatch(req('GET', '/facade/handler'));
        expect(await res.text()).toBe('from handler');
    });

    it('passes the context to the instance method', async () => {
        class UserHandler {
            show(ctx: Request): Reply {
                return Reply.text(`user ${ctx.param('id')}`);
            }
        }
        Route.get('/facade/users/:id', [UserHandler, 'show']);

        const res = await router.dispatch(req('GET', '/facade/users/7'));
        expect(await res.text()).toBe('user 7');
    });

    it('instantiates a fresh handler per request', async () => {
        let created = 0;
        class CountingHandler {
            private readonly id = ++created;
            show(): Reply {
                return Reply.text(`#${this.id}`);
            }
        }
        Route.get('/facade/counter', [CountingHandler, 'show']);

        expect(
            await (await router.dispatch(req('GET', '/facade/counter'))).text(),
        ).toBe('#1');
        expect(
            await (await router.dispatch(req('GET', '/facade/counter'))).text(),
        ).toBe('#2');
    });

    it('getAll registers a GET per controller method with a kebab-cased path', async () => {
        class GetAllController {
            index(): Reply {
                return Reply.text('idx');
            }
            listUsers(): Reply {
                return Reply.text('camel');
            }
            delete_user(): Reply {
                return Reply.text('snake');
            }
        }
        Route.getAll('/ga', GetAllController);

        expect(
            await (await router.dispatch(req('GET', '/ga/index'))).text(),
        ).toBe('idx');
        expect(
            await (await router.dispatch(req('GET', '/ga/list-users'))).text(),
        ).toBe('camel');
        expect(
            await (await router.dispatch(req('GET', '/ga/delete-user'))).text(),
        ).toBe('snake');
    });
});

describe('Route.group', () => {
    it('prefixes every route defined inside the group', async () => {
        Route.group('/v1', () => {
            Route.get('/users', () => Reply.text('list'));
            Route.post('/users', () => Reply.text('create'));
        });

        expect(
            await (await router.dispatch(req('GET', '/v1/users'))).text(),
        ).toBe('list');
        expect(
            await (await router.dispatch(req('POST', '/v1/users'))).text(),
        ).toBe('create');
    });

    it('does not affect routes defined outside the group', async () => {
        Route.group('/v1', () => {
            Route.get('/inside', () => Reply.text('inside'));
        });
        Route.get('/outside', () => Reply.text('outside'));

        expect(
            await (await router.dispatch(req('GET', '/outside'))).text(),
        ).toBe('outside');
        expect((await router.dispatch(req('GET', '/v1/outside'))).status).toBe(
            404,
        );
    });

    it('nests groups', async () => {
        Route.group('/api', () => {
            Route.group('/v2', () => {
                Route.get('/ping', () => Reply.text('pong'));
            });
        });

        expect(
            await (await router.dispatch(req('GET', '/api/v2/ping'))).text(),
        ).toBe('pong');
    });

    it('keeps params inside a group', async () => {
        Route.group('/shop', () => {
            Route.get('/item/:id', (ctx) =>
                Reply.text(`item ${ctx.params.id}`),
            );
        });

        expect(
            await (await router.dispatch(req('GET', '/shop/item/7'))).text(),
        ).toBe('item 7');
    });

    it('normalizes slashes between prefix and path', async () => {
        Route.group('/norm/', () => {
            Route.get('thing', () => Reply.text('ok'));
        });

        expect(
            await (await router.dispatch(req('GET', '/norm/thing'))).text(),
        ).toBe('ok');
    });

    it('groups without a prefix', async () => {
        Route.group(() => {
            Route.get('/np/a', () => Reply.text('a'));
            Route.get('/np/b', () => Reply.text('b'));
        });

        expect(await (await router.dispatch(req('GET', '/np/a'))).text()).toBe(
            'a',
        );
        expect(await (await router.dispatch(req('GET', '/np/b'))).text()).toBe(
            'b',
        );
    });

    it('applies a prefixless group renderError to its routes', async () => {
        Route.group(() => {
            Route.get('/np/boom', () => {
                throw new Error('x');
            });
        }).renderError(() => Reply.text('grouped').status(500));

        const res = await router.dispatch(req('GET', '/np/boom'));
        expect(res.status).toBe(500);
        expect(await res.text()).toBe('grouped');
    });

    it('covers 404s under a prefixless group route path', async () => {
        Route.group(() => {
            Route.get('/np3/thing', () => Reply.text('ok'));
        }).renderError(() => Reply.text('grouped404').status(404));

        const res = await router.dispatch(req('GET', '/np3/thing/deeper'));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('grouped404');
    });
});
