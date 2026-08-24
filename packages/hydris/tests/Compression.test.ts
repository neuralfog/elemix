import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { gunzipSync } from 'node:zlib';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetHandler } from '../src/http/assets';
import {
    compressDynamic,
    resetCompression,
    setCompression,
    warmAsset,
} from '../src/http/compression';
import { Request } from '../src/http/Request';
import { Reply } from '../src/http/Reply';
import { MatchedRoute } from '../src/routing/MatchedRoute';
import { Router } from '../src/routing/Router';

let dir: string;
const big = 'x'.repeat(4096);

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'hydris-compress-'));
    writeFileSync(join(dir, 'app.js'), `console.log("${big}");`);
    writeFileSync(join(dir, 'tiny.js'), 'ok');
    writeFileSync(join(dir, 'logo.png'), Buffer.alloc(4096, 1));
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
    resetCompression();
});

const assetReq = (star: string, accept?: string): Request => {
    const headers = new Headers();
    if (accept !== undefined) headers.set('accept-encoding', accept);
    const raw = {
        url: 'http://localhost/static/x',
        method: 'GET',
        headers,
    } as unknown as globalThis.Request;
    return new Request(raw, new MatchedRoute({} as never, { '*': star }));
};

const dynamicReq = (accept?: string, method = 'GET'): Request => {
    const headers = new Headers();
    if (accept !== undefined) headers.set('accept-encoding', accept);
    return new Request({
        url: 'http://localhost/page',
        method,
        headers,
    } as unknown as globalThis.Request);
};

describe('static asset compression', () => {
    it('leaves assets untouched when compression is off', async () => {
        const res = await assetHandler({ dir })(assetReq('app.js', 'br, gzip'));
        expect(res.headers.get('content-encoding')).toBeNull();
        expect(res.headers.get('vary')).toBeNull();
    });

    it('serves brotli when the client prefers it', async () => {
        setCompression();
        const res = await assetHandler({ dir })(assetReq('app.js', 'br, gzip'));
        expect(res.headers.get('content-encoding')).toBe('br');
        expect(res.headers.get('vary')).toBe('Accept-Encoding');
        const body = new Uint8Array(await res.arrayBuffer());
        expect(body.length).toBeLessThan(big.length);
    });

    it('falls back to gzip when brotli is unavailable', async () => {
        setCompression();
        const res = await assetHandler({ dir })(assetReq('app.js', 'gzip'));
        expect(res.headers.get('content-encoding')).toBe('gzip');
        const decoded = gunzipSync(
            new Uint8Array(await res.arrayBuffer()),
        ).toString();
        expect(decoded).toContain('console.log');
    });

    it('serves identity when the client accepts no encoding', async () => {
        setCompression();
        const res = await assetHandler({ dir })(assetReq('app.js'));
        expect(res.headers.get('content-encoding')).toBeNull();
        expect(res.headers.get('vary')).toBe('Accept-Encoding');
    });

    it('does not compress below the threshold', async () => {
        setCompression();
        const res = await assetHandler({ dir })(assetReq('tiny.js', 'br'));
        expect(res.headers.get('content-encoding')).toBeNull();
    });

    it('does not compress incompressible types', async () => {
        setCompression();
        const res = await assetHandler({ dir })(assetReq('logo.png', 'br'));
        expect(res.headers.get('content-encoding')).toBeNull();
    });

    it('respects a disabled brotli option', async () => {
        setCompression({ brotli: false });
        const res = await assetHandler({ dir })(assetReq('app.js', 'br, gzip'));
        expect(res.headers.get('content-encoding')).toBe('gzip');
    });

    it('caches the compressed bytes per asset', async () => {
        setCompression();
        const a = await assetHandler({ dir })(assetReq('app.js', 'br'));
        const b = await assetHandler({ dir })(assetReq('app.js', 'br'));
        const first = new Uint8Array(await a.arrayBuffer());
        const second = new Uint8Array(await b.arrayBuffer());
        expect(second).toEqual(first);
    });
});

describe('build-emitted disk siblings', () => {
    it('serves a .br sibling verbatim instead of recompressing', async () => {
        setCompression();
        const name = 'sibling-a.js';
        const sentinel = Buffer.from('SENTINEL_BROTLI_PAYLOAD_FROM_DISK');
        writeFileSync(join(dir, name), `console.log("${big}");`);
        writeFileSync(join(dir, `${name}.br`), sentinel);
        const res = await assetHandler({ dir })(assetReq(name, 'br'));
        expect(res.headers.get('content-encoding')).toBe('br');
        const body = new Uint8Array(await res.arrayBuffer());
        expect(Buffer.from(body).toString()).toBe(sentinel.toString());
    });

    it('warmAsset loads a sibling into the cache', async () => {
        setCompression();
        const name = 'sibling-b.js';
        const sentinel = Buffer.from('SENTINEL_GZIP_PAYLOAD_FROM_DISK_XX');
        writeFileSync(join(dir, name), `console.log("${big}");`);
        writeFileSync(join(dir, `${name}.gz`), sentinel);
        await warmAsset(join(dir, name));
        const res = await assetHandler({ dir })(assetReq(name, 'gzip'));
        const body = new Uint8Array(await res.arrayBuffer());
        expect(Buffer.from(body).toString()).toBe(sentinel.toString());
    });
});

describe('asset precompute (warmAsset)', () => {
    it('returns null when compression is off', async () => {
        expect(await warmAsset(join(dir, 'app.js'))).toBeNull();
    });

    it('precompresses a compressible asset into the cache', async () => {
        setCompression();
        const result = await warmAsset(join(dir, 'app.js'));
        expect(result).not.toBeNull();
        expect(result?.best).toBeLessThan(result?.raw ?? 0);
    });

    it('serves the warmed bytes from cache without regenerating', async () => {
        setCompression();
        const warmed = await warmAsset(join(dir, 'app.js'));
        expect(warmed).not.toBeNull();
        const res = await assetHandler({ dir })(assetReq('app.js', 'br'));
        const served = new Uint8Array(await res.arrayBuffer());
        expect(res.headers.get('content-encoding')).toBe('br');
        expect(served.length).toBe((warmed as { best: number }).best);
    });

    it('skips incompressible and tiny assets', async () => {
        setCompression();
        expect(await warmAsset(join(dir, 'logo.png'))).toBeNull();
        expect(await warmAsset(join(dir, 'tiny.js'))).toBeNull();
    });

    it('writes .br/.gz siblings to disk when asked', async () => {
        setCompression();
        const name = 'warm-write.js';
        const path = join(dir, name);
        writeFileSync(path, `console.log("${big}");`);
        await warmAsset(path, undefined, true);
        const br = Bun.file(`${path}.br`);
        const gz = Bun.file(`${path}.gz`);
        expect(await br.exists()).toBe(true);
        expect(await gz.exists()).toBe(true);
        expect(br.size).toBeLessThan((await Bun.file(path).stat()).size);
    });

    it('does not write siblings unless asked', async () => {
        setCompression();
        const name = 'warm-nowrite.js';
        const path = join(dir, name);
        writeFileSync(path, `console.log("${big}");`);
        await warmAsset(path);
        expect(await Bun.file(`${path}.br`).exists()).toBe(false);
    });
});

describe('dynamic response compression', () => {
    const htmlReply = (): Response =>
        Reply.html(`<!doctype html><html><body>${big}</body></html>`)
            .cookie('sid', 'abc')
            .toResponse();

    it('is a no-op when compression is off', async () => {
        const res = await compressDynamic(htmlReply(), dynamicReq('br'));
        expect(res.headers.get('content-encoding')).toBeNull();
    });

    it('compresses html the client accepts', async () => {
        setCompression();
        const res = await compressDynamic(htmlReply(), dynamicReq('br, gzip'));
        expect(res.headers.get('content-encoding')).toBe('br');
        expect(res.headers.get('vary')).toBe('Accept-Encoding');
    });

    it('preserves Set-Cookie through compression', async () => {
        setCompression();
        const res = await compressDynamic(htmlReply(), dynamicReq('gzip'));
        expect(res.headers.get('content-encoding')).toBe('gzip');
        const cookies = res.headers.getSetCookie();
        expect(cookies.some((c) => c.startsWith('sid=abc'))).toBe(true);
        const decoded = gunzipSync(
            new Uint8Array(await res.arrayBuffer()),
        ).toString();
        expect(decoded).toContain('<body>');
    });

    it('skips HEAD requests', async () => {
        setCompression();
        const res = await compressDynamic(
            htmlReply(),
            dynamicReq('br', 'HEAD'),
        );
        expect(res.headers.get('content-encoding')).toBeNull();
    });

    it('does not double-encode an already encoded response', async () => {
        setCompression();
        const pre = new Response('body', {
            headers: {
                'content-type': 'text/html',
                'content-encoding': 'gzip',
            },
        });
        const res = await compressDynamic(pre, dynamicReq('br'));
        expect(res.headers.get('content-encoding')).toBe('gzip');
    });

    it('leaves json below the threshold uncompressed but marks Vary', async () => {
        setCompression();
        const res = await compressDynamic(
            Reply.json({ ok: true }).toResponse(),
            dynamicReq('br'),
        );
        expect(res.headers.get('content-encoding')).toBeNull();
        expect(res.headers.get('vary')).toBe('Accept-Encoding');
    });

    it('does not compress redirects', async () => {
        setCompression();
        const res = await compressDynamic(
            Reply.redirect('/elsewhere').toResponse(),
            dynamicReq('br'),
        );
        expect(res.headers.get('content-encoding')).toBeNull();
    });
});

describe('router integration', () => {
    const routed = (path: string, accept: string): Request =>
        new Request({
            url: `http://localhost${path}`,
            method: 'GET',
            headers: new Headers({ 'accept-encoding': accept }),
        } as unknown as globalThis.Request);

    it('compresses a dynamic route through dispatch', async () => {
        setCompression();
        const router = new Router();
        router.register('GET', '/page', () =>
            Reply.html(`<!doctype html><body>${big}</body>`),
        );
        const res = await router.dispatch(routed('/page', 'br, gzip'));
        expect(res.headers.get('content-encoding')).toBe('br');
    });

    it('compresses a static asset through dispatch', async () => {
        setCompression();
        const router = new Router();
        router.registerStatic('/static/*', assetHandler({ dir }));
        const res = await router.dispatch(routed('/static/app.js', 'gzip'));
        expect(res.headers.get('content-encoding')).toBe('gzip');
        const decoded = gunzipSync(
            new Uint8Array(await res.arrayBuffer()),
        ).toString();
        expect(decoded).toContain('console.log');
    });

    it('leaves everything untouched when disabled', async () => {
        const router = new Router();
        router.register('GET', '/page', () =>
            Reply.html(`<!doctype html><body>${big}</body>`),
        );
        const res = await router.dispatch(routed('/page', 'br, gzip'));
        expect(res.headers.get('content-encoding')).toBeNull();
    });
});
