import { describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { Reply } from '../src/http/Reply';
import { Request } from '../src/http/Request';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Router } from '../src/routing/Router';

class TokenStore {
    readonly secret = 'my-secret-token';
}

class EnsureTokenIsValid extends BaseMiddleware {
    constructor(private readonly store: TokenStore) {
        super();
    }

    handle(ctx: Request, next: Next) {
        if (ctx.query.token !== this.store.secret) {
            return Reply.redirect('/home');
        }
        return next();
    }
}

const request = (path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method: Method.Get,
        headers: new Headers(),
    } as unknown as globalThis.Request);

describe('injectable middleware (Laravel-style, class form)', () => {
    it('resolves the middleware from the container with its constructor dep injected', async () => {
        const router = new Router();
        router.use([EnsureTokenIsValid]);
        router.register(Method.Get, '/secure', () => Reply.text('ok'));

        const denied = await router.dispatch(request('/secure'));
        expect(denied.status).toBe(302);
        expect(denied.headers.get('location')).toBe('/home');

        const allowed = await router.dispatch(
            request('/secure?token=my-secret-token'),
        );
        expect(allowed.status).toBe(200);
        expect(await allowed.text()).toBe('ok');
    });

    it('injects the same dep into a route-level middleware too', async () => {
        const router = new Router();
        router
            .register(Method.Get, '/gate', () => Reply.text('through'))
            .middlewares.push(EnsureTokenIsValid);

        const allowed = await router.dispatch(
            request('/gate?token=my-secret-token'),
        );
        expect(await allowed.text()).toBe('through');
    });
});
