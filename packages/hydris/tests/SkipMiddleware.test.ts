import { describe, expect, it } from 'bun:test';
import type { Context } from '../src/http/Context';
import type { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { Router } from '../src/routing/Router';

const request = (path: string): Request =>
    ({
        url: `http://localhost${path}`,
        method: 'GET',
        headers: new Headers(),
    }) as unknown as Request;

class Tagger extends BaseMiddleware {
    static hits = 0;
    async handle(_ctx: Context, next: Next): Promise<Response> {
        Tagger.hits++;
        return next();
    }
}

describe('skipMiddlewares', () => {
    it('runs a global middleware normally, skips it where opted out (global instance, skip by class)', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([new Tagger()]);
        router.register('GET', '/guarded', () => Reply.text('a'));
        router
            .register('GET', '/open', () => Reply.text('b'))
            .skip.push(Tagger);

        await router.dispatch(request('/guarded'));
        expect(Tagger.hits).toBe(1);

        await router.dispatch(request('/open'));
        expect(Tagger.hits).toBe(1);
    });

    it('skips a global middleware registered as a class', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([Tagger]);
        router
            .register('GET', '/open', () => Reply.text('b'))
            .skip.push(Tagger);
        await router.dispatch(request('/open'));
        expect(Tagger.hits).toBe(0);
    });

    it('skips a specific global instance by identity', async () => {
        Tagger.hits = 0;
        const mw = new Tagger();
        const router = new Router();
        router.use([mw]);
        router.register('GET', '/open', () => Reply.text('b')).skip.push(mw);
        await router.dispatch(request('/open'));
        expect(Tagger.hits).toBe(0);
    });

    it('leaves other routes untouched', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([new Tagger()]);
        router.register('GET', '/a', () => Reply.text('a'));
        router.register('GET', '/b', () => Reply.text('b')).skip.push(Tagger);
        router.register('GET', '/c', () => Reply.text('c'));

        await router.dispatch(request('/a'));
        await router.dispatch(request('/b'));
        await router.dispatch(request('/c'));
        expect(Tagger.hits).toBe(2);
    });
});
