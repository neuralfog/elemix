import { describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';
import { Request } from '../src/http/Request';
import { Cors } from '../src/middleware/Cors';
import type { Next } from '../src/middleware/Middleware';
import { Route, router } from '../src/routing/Route';

const ctx = (method: string, headers: Record<string, string> = {}): Request =>
    new Request({
        method,
        headers: new Headers(headers),
    } as unknown as globalThis.Request);

const ok: Next = async () => new Response('ok', { status: 200 });

describe('Cors config passed to the constructor', () => {
    it('echoes a configured origin and sets credentials', async () => {
        const cors = new Cors({
            origin: 'https://app.example',
            credentials: true,
        });
        const res = await cors.handle(
            ctx('GET', { origin: 'https://app.example' }),
            ok,
        );
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.example',
        );
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBe(
            'true',
        );
        expect(res.headers.get('Vary')).toContain('Origin');
    });

    it('rejects an origin not in the configured list', async () => {
        const cors = new Cors({
            origin: ['https://a.example', 'https://b.example'],
        });
        const res = await cors.handle(
            ctx('GET', { origin: 'https://evil.example' }),
            ok,
        );
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('defaults to a wildcard origin with no config', async () => {
        const res = await new Cors().handle(
            ctx('GET', { origin: 'https://anything.example' }),
            ok,
        );
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('answers preflight with the configured methods, headers and max-age', async () => {
        const cors = new Cors({
            methods: ['GET', 'POST'],
            allowedHeaders: ['X-Token'],
            maxAge: 600,
        });
        const res = await cors.handle(
            ctx('OPTIONS', { origin: 'https://app.example' }),
            ok,
        );
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, POST',
        );
        expect(res.headers.get('Access-Control-Allow-Headers')).toBe('X-Token');
        expect(res.headers.get('Access-Control-Max-Age')).toBe('600');
    });
});

describe('Cors instance in the route pipeline', () => {
    it('runs a configured instance passed to .middlewares()', async () => {
        Route.get('/cors/ping', () => Reply.text('pong')).middlewares([
            new Cors({ origin: 'https://app.example' }),
        ]);

        const req = new Request({
            url: 'http://localhost/cors/ping',
            method: 'GET',
            headers: new Headers({ origin: 'https://app.example' }),
        } as unknown as globalThis.Request);

        const res = await router.dispatch(req);
        expect(await res.text()).toBe('pong');
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.example',
        );
    });
});
