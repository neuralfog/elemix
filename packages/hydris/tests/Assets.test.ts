import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/App';
import { assetHandler } from '../src/http/assets';
import { Request } from '../src/http/Request';
import { BaseMiddleware, type Next } from '../src/middleware/Middleware';
import { MatchedRoute } from '../src/routing/MatchedRoute';
import { Route, router } from '../src/routing/Route';
import { Router } from '../src/routing/Router';

let dir: string;

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'hydris-assets-'));
    writeFileSync(join(dir, 'hello.txt'), 'hello world');
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'nested.txt'), 'nested');
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

const reqWith = (star: string, url = 'http://localhost/x'): Request => {
    const raw = {
        url,
        method: 'GET',
        headers: new Headers(),
    } as unknown as globalThis.Request;
    return new Request(raw, new MatchedRoute({} as never, { '*': star }));
};

const request = (path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method: 'GET',
        headers: new Headers(),
    } as unknown as globalThis.Request);

describe('assetHandler', () => {
    it('serves a file inside the dir', async () => {
        const res = await assetHandler({ dir })(reqWith('hello.txt'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');
    });

    it('serves nested files', async () => {
        const res = await assetHandler({ dir })(reqWith('sub/nested.txt'));
        expect(await res.text()).toBe('nested');
    });

    it('404s for a missing file', async () => {
        const res = await assetHandler({ dir })(reqWith('nope.txt'));
        expect(res.status).toBe(404);
    });

    it('blocks path traversal out of the dir', async () => {
        const res = await assetHandler({ dir })(reqWith('../../etc/passwd'));
        expect(res.status).toBe(404);
    });

    it('applies Cache-Control when configured', async () => {
        const res = await assetHandler({ dir, maxAge: 3600, immutable: true })(
            reqWith('hello.txt'),
        );
        expect(res.headers.get('cache-control')).toBe(
            'public, max-age=3600, immutable',
        );
    });

    it('sets no Cache-Control by default', async () => {
        const res = await assetHandler({ dir })(reqWith('hello.txt'));
        expect(res.headers.get('cache-control')).toBeNull();
    });

    it('serves immutable when the request carries ?v= (busted url)', async () => {
        const res = await assetHandler({ dir })(
            reqWith('hello.txt', 'http://localhost/static/hello.txt?v=abc'),
        );
        expect(res.headers.get('cache-control')).toBe(
            `public, max-age=${31536000}, immutable`,
        );
    });

    it('does NOT serve immutable for a bare request (no ?v=)', async () => {
        const res = await assetHandler({ dir, maxAge: 60 })(
            reqWith('hello.txt', 'http://localhost/static/hello.txt'),
        );
        expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    });
});

class Tagger extends BaseMiddleware {
    static hits = 0;
    async handle(_req: Request, next: Next): Promise<Response> {
        Tagger.hits++;
        return next();
    }
}

describe('static route dispatch', () => {
    it('serves a static route without running global middleware', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([new Tagger()]);
        router.registerStatic('/files/*', assetHandler({ dir }));

        const res = await router.dispatch(request('/files/hello.txt'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');
        expect(Tagger.hits).toBe(0);
    });

    it('still runs middleware for a normal route', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([new Tagger()]);
        router.registerStatic('/files/*', assetHandler({ dir }));
        router.register('GET', '/page', () => new Response('page'));

        await router.dispatch(request('/page'));
        expect(Tagger.hits).toBe(1);
    });
});

describe('App.assets', () => {
    it('registers a static mount served through the router', async () => {
        App.assets('/public', { dir });
        const res = await router.dispatch(request('/public/hello.txt'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');
    });

    it('supports multiple independent mounts', async () => {
        App.assets('/one', { dir });
        App.assets('/two', { dir });
        const a = await router.dispatch(request('/one/hello.txt'));
        const b = await router.dispatch(request('/two/sub/nested.txt'));
        expect(await a.text()).toBe('hello world');
        expect(await b.text()).toBe('nested');
    });

    it('lets a real route take priority over an asset mount', async () => {
        App.assets('/mixed', { dir });
        Route.get('/mixed/live', () => new Response('dynamic'));
        const res = await router.dispatch(request('/mixed/live'));
        expect(await res.text()).toBe('dynamic');
    });
});
