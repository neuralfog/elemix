import { describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';
import { Request as HydrisRequest } from '../src/http/Request';
import { Csrf } from '../src/middleware/Csrf';
import type { Next } from '../src/middleware/Middleware';
import { Router } from '../src/routing/Router';

const SECRET = 'test-secret-key';
const ok: Next = async () => new Response('ok', { status: 200 });

const contextFor = (
    method: string,
    init: {
        cookie?: string;
        body?: BodyInit;
        headers?: Record<string, string>;
    } = {},
): HydrisRequest => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set('cookie', init.cookie);
    const raw = new Request('http://localhost/', {
        method,
        headers,
        body: init.body,
    });
    return new HydrisRequest(raw, null);
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
        await expect(
            new Csrf({ secret: SECRET }).handle(contextFor('POST'), ok),
        ).rejects.toThrow('Invalid CSRF token');
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
        await expect(
            new Csrf({ secret: SECRET }).handle(
                contextFor('POST', {
                    cookie,
                    headers: { 'x-csrf-token': 'not-the-token' },
                }),
                ok,
            ),
        ).rejects.toThrow('Invalid CSRF token');
    });

    it('rejects a POST with a tampered cookie signature', async () => {
        const { token, cookie } = await issue();
        await expect(
            new Csrf({ secret: SECRET }).handle(
                contextFor('POST', {
                    cookie: `${cookie}tampered`,
                    headers: { 'x-csrf-token': token },
                }),
                ok,
            ),
        ).rejects.toThrow('Invalid CSRF token');
    });

    it('rejects a token signed with a different secret', async () => {
        const { token, cookie } = await issue();
        await expect(
            new Csrf({ secret: 'other-secret' }).handle(
                contextFor('POST', {
                    cookie,
                    headers: { 'x-csrf-token': token },
                }),
                ok,
            ),
        ).rejects.toThrow('Invalid CSRF token');
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
        await expect(
            mw.handle(
                contextFor('POST', {
                    cookie,
                    headers: {
                        'x-csrf-token': token,
                        origin: 'https://evil.example',
                    },
                }),
                ok,
            ),
        ).rejects.toThrow('Invalid CSRF token');

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

describe('Csrf failure rendering (content negotiation)', () => {
    const guarded = (): Router => {
        const r = new Router();
        r.register('POST', '/guard', () => Reply.text('ok')).middlewares.push(
            new Csrf({ secret: SECRET }),
        );
        return r;
    };

    const post = (accept: string): HydrisRequest =>
        new HydrisRequest(
            new Request('http://localhost/guard', {
                method: 'POST',
                headers: { accept },
            }),
        );

    it('renders a JSON 403 for an AJAX request (Accept: application/json)', async () => {
        const res = await guarded().dispatch(post('application/json'));
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({
            error: 'Invalid CSRF token',
            status: 403,
        });
    });

    it('renders an HTML 403 for a browser request (Accept: text/html)', async () => {
        const res = await guarded().dispatch(post('text/html'));
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(await res.text()).toContain('Invalid CSRF token');
    });
});
