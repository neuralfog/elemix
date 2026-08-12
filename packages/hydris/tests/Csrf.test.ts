import { describe, expect, it } from 'bun:test';
import { Context } from '../src/http/Context';
import type { Request as HydrisRequest } from '../src/http/Request';
import { Csrf } from '../src/middleware/Csrf';
import type { Next } from '../src/middleware/Middleware';

const SECRET = 'test-secret-key';
const ok: Next = async () => new Response('ok', { status: 200 });

const contextFor = (
    method: string,
    init: {
        cookie?: string;
        body?: BodyInit;
        headers?: Record<string, string>;
    } = {},
): Context => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set('cookie', init.cookie);
    const req = new Request('http://localhost/', {
        method,
        headers,
        body: init.body,
    }) as unknown as HydrisRequest;
    return new Context(req, null);
};

const cookieValue = (res: Response): string => {
    const set = res.headers.get('set-cookie') ?? '';
    return /csrf=([^;]+)/.exec(set)?.[1] ?? '';
};

const issue = async (): Promise<{ token: string; cookie: string }> => {
    const mw = new Csrf({ secret: SECRET });
    const ctx = contextFor('GET');
    const res = await mw.handle(ctx, ok);
    return { token: ctx.csrf, cookie: `csrf=${cookieValue(res)}` };
};

describe('Csrf', () => {
    it('issues a token cookie on a safe request and exposes ctx.csrf', async () => {
        const mw = new Csrf({ secret: SECRET });
        const ctx = contextFor('GET');
        const res = await mw.handle(ctx, ok);
        expect(res.status).toBe(200);
        expect(ctx.csrf.length).toBeGreaterThan(0);
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toContain('csrf=');
        expect(set).toContain('HttpOnly');
        expect(cookieValue(res)).toContain(`${ctx.csrf}.`);
    });

    it('does not validate safe methods', async () => {
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('HEAD'),
            ok,
        );
        expect(res.status).toBe(200);
    });

    it('rejects an unsafe request with no token', async () => {
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('POST'),
            ok,
        );
        expect(res.status).toBe(403);
    });

    it('accepts a POST whose header token matches the cookie', async () => {
        const { token, cookie } = await issue();
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('POST', { cookie, headers: { 'x-csrf-token': token } }),
            ok,
        );
        expect(res.status).toBe(200);
    });

    it('rejects a POST whose header token does not match', async () => {
        const { cookie } = await issue();
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('POST', {
                cookie,
                headers: { 'x-csrf-token': 'not-the-token' },
            }),
            ok,
        );
        expect(res.status).toBe(403);
    });

    it('rejects a POST with a tampered cookie signature', async () => {
        const { token, cookie } = await issue();
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('POST', {
                cookie: `${cookie}tampered`,
                headers: { 'x-csrf-token': token },
            }),
            ok,
        );
        expect(res.status).toBe(403);
    });

    it('rejects a token signed with a different secret', async () => {
        const { token, cookie } = await issue();
        const res = await new Csrf({ secret: 'other-secret' }).handle(
            contextFor('POST', { cookie, headers: { 'x-csrf-token': token } }),
            ok,
        );
        expect(res.status).toBe(403);
    });

    it('accepts a token submitted as a form field', async () => {
        const { token, cookie } = await issue();
        const res = await new Csrf({ secret: SECRET }).handle(
            contextFor('POST', {
                cookie,
                body: new URLSearchParams({ _csrf: token }),
            }),
            ok,
        );
        expect(res.status).toBe(200);
    });

    it('enforces trusted origins when configured', async () => {
        const { token, cookie } = await issue();
        const mw = new Csrf({
            secret: SECRET,
            trustedOrigins: ['https://app.example'],
        });
        const bad = await mw.handle(
            contextFor('POST', {
                cookie,
                headers: {
                    'x-csrf-token': token,
                    origin: 'https://evil.example',
                },
            }),
            ok,
        );
        expect(bad.status).toBe(403);

        const good = await mw.handle(
            contextFor('POST', {
                cookie,
                headers: {
                    'x-csrf-token': token,
                    origin: 'https://app.example',
                },
            }),
            ok,
        );
        expect(good.status).toBe(200);
    });
});
