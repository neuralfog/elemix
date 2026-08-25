import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/App';
import { AssetHandler } from '../src/http/AssetHandler';
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
        method: Method.Get,
        headers: new Headers(),
    } as unknown as globalThis.Request;
    return new Request(raw, new MatchedRoute({} as never, { '*': star }));
};

const request = (path: string): Request =>
    new Request({
        url: `http://localhost${path}`,
        method: Method.Get,
        headers: new Headers(),
    } as unknown as globalThis.Request);

describe('assetHandler', () => {
    it('serves a file inside the dir', async () => {
        const res = await AssetHandler.create({ dir })(reqWith('hello.txt'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');
    });

    it('serves nested files', async () => {
        const res = await AssetHandler.create({ dir })(
            reqWith('sub/nested.txt'),
        );
        expect(await res.text()).toBe('nested');
    });

    it('404s for a missing file', async () => {
        const res = await AssetHandler.create({ dir })(reqWith('nope.txt'));
        expect(res.status).toBe(404);
    });

    it('blocks path traversal out of the dir', async () => {
        const res = await AssetHandler.create({ dir })(
            reqWith('../../etc/passwd'),
        );
        expect(res.status).toBe(404);
    });

    it('applies immutable Cache-Control when configured', async () => {
        const res = await AssetHandler.create({
            dir,
            maxAge: 3600,
            immutable: true,
        })(reqWith('hello.txt'));
        expect(res.headers.get('cache-control')).toBe(
            'public, max-age=3600, immutable',
        );
    });

    it('revalidates (no-cache) by default so assets bust without a version', async () => {
        const res = await AssetHandler.create({ dir })(reqWith('hello.txt'));
        expect(res.headers.get('cache-control')).toBe('no-cache');
    });

    it('applies a plain max-age when configured without immutable', async () => {
        const res = await AssetHandler.create({ dir, maxAge: 60 })(
            reqWith('hello.txt'),
        );
        expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    });

    it('sends an ETag and returns 304 when it matches', async () => {
        const first = await AssetHandler.create({ dir })(reqWith('hello.txt'));
        const etag = first.headers.get('etag');
        expect(etag).not.toBeNull();

        const raw = {
            url: 'http://localhost/x',
            method: Method.Get,
            headers: new Headers({ 'if-none-match': etag as string }),
        } as unknown as globalThis.Request;
        const cached = await AssetHandler.create({ dir })(
            new Request(
                raw,
                new MatchedRoute({} as never, { '*': 'hello.txt' }),
            ),
        );
        expect(cached.status).toBe(304);
        expect(cached.headers.get('etag')).toBe(etag);
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
        router.registerStatic('/files/*', AssetHandler.create({ dir }));

        const res = await router.dispatch(request('/files/hello.txt'));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');
        expect(Tagger.hits).toBe(0);
    });

    it('still runs middleware for a normal route', async () => {
        Tagger.hits = 0;
        const router = new Router();
        router.use([new Tagger()]);
        router.registerStatic('/files/*', AssetHandler.create({ dir }));
        router.register(Method.Get, '/page', () => new Response('page'));

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
