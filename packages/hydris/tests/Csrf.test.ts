import { beforeEach, describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { CookieAuthority } from '../src/http/CookieAuthority';
import { Reply } from '../src/http/Reply';
import { Request as HydrisRequest } from '../src/http/Request';
import { Csrf } from '../src/middleware/Csrf';
import type { Next } from '../src/middleware/Middleware';
import { Router } from '../src/routing/Router';

const SECRET = 'test-secret-key';
const ok: Next = async () => new Response('ok', { status: 200 });

beforeEach(() => {
    CookieAuthority.secret(SECRET);
    Csrf.config({});
});

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

const csrf = (req: HydrisRequest): Csrf => new Csrf(new CookieAuthority(req));

const cookieValue = (res: Response): string => {
    const set = res.headers.get('set-cookie') ?? '';
    return /csrf=([^;]+)/.exec(set)?.[1] ?? '';
};

const issue = async (): Promise<{ token: string; cookie: string }> => {
    const req = contextFor(Method.Get);
    const res = await csrf(req).handle(req, ok);
    return { token: req.csrf, cookie: `csrf=${cookieValue(res)}` };
};

describe('Csrf', () => {
    it('issues a token cookie on a safe request and exposes ctx.csrf', async () => {
        const req = contextFor(Method.Get);
        const res = await csrf(req).handle(req, ok);
        expect(res.status).toBe(200);
        expect(req.csrf.length).toBeGreaterThan(0);
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toContain('csrf=');
        expect(set).toContain('HttpOnly');
        expect(decodeURIComponent(cookieValue(res))).toContain(`${req.csrf}.`);
    });

    it('does not validate safe methods', async () => {
        const req = contextFor(Method.Head);
        const res = await csrf(req).handle(req, ok);
        expect(res.status).toBe(200);
    });

    it('rejects an unsafe request with no token', async () => {
        const req = contextFor(Method.Post);
        await expect(csrf(req).handle(req, ok)).rejects.toThrow(
            'Invalid CSRF token',
        );
    });

    it('accepts a POST whose header token matches the cookie', async () => {
        const { token, cookie } = await issue();
        const req = contextFor(Method.Post, {
            cookie,
            headers: { 'x-csrf-token': token },
        });
        const res = await csrf(req).handle(req, ok);
        expect(res.status).toBe(200);
    });

    it('rejects a POST whose header token does not match', async () => {
        const { cookie } = await issue();
        const req = contextFor(Method.Post, {
            cookie,
            headers: { 'x-csrf-token': 'not-the-token' },
        });
        await expect(csrf(req).handle(req, ok)).rejects.toThrow(
            'Invalid CSRF token',
        );
    });

    it('rejects a POST with a tampered cookie signature', async () => {
        const { token, cookie } = await issue();
        const req = contextFor(Method.Post, {
            cookie: `${cookie}tampered`,
            headers: { 'x-csrf-token': token },
        });
        await expect(csrf(req).handle(req, ok)).rejects.toThrow(
            'Invalid CSRF token',
        );
    });

    it('rejects a cookie token signed with a different secret', async () => {
        const token = 'sometoken';
        CookieAuthority.secret('other-secret');
        const foreign = new CookieAuthority(contextFor(Method.Get)).sign(
            'csrf',
            token,
        );
        CookieAuthority.secret(SECRET);
        const req = contextFor(Method.Post, {
            cookie: `csrf=${encodeURIComponent(foreign)}`,
            headers: { 'x-csrf-token': token },
        });
        await expect(csrf(req).handle(req, ok)).rejects.toThrow(
            'Invalid CSRF token',
        );
    });

    it('accepts a token submitted as a form field', async () => {
        const { token, cookie } = await issue();
        const req = contextFor(Method.Post, {
            cookie,
            body: new URLSearchParams({ _csrf: token }),
        });
        const res = await csrf(req).handle(req, ok);
        expect(res.status).toBe(200);
    });

    it('enforces trusted origins when configured', async () => {
        Csrf.config({ trustedOrigins: ['https://app.example'] });
        const { token, cookie } = await issue();

        const denied = contextFor(Method.Post, {
            cookie,
            headers: {
                'x-csrf-token': token,
                origin: 'https://evil.example',
            },
        });
        await expect(csrf(denied).handle(denied, ok)).rejects.toThrow(
            'Invalid CSRF token',
        );

        const allowed = contextFor(Method.Post, {
            cookie,
            headers: {
                'x-csrf-token': token,
                origin: 'https://app.example',
            },
        });
        const good = await csrf(allowed).handle(allowed, ok);
        expect(good.status).toBe(200);
    });
});

describe('Csrf failure rendering (content negotiation)', () => {
    const guarded = (): Router => {
        const r = new Router();
        r.register(Method.Post, '/guard', () =>
            Reply.text('ok'),
        ).middlewares.push(Csrf);
        return r;
    };

    const post = (accept: string): HydrisRequest =>
        new HydrisRequest(
            new Request('http://localhost/guard', {
                method: Method.Post,
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
