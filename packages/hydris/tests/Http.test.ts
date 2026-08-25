import { describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { CookieAuthority } from '../src/http/CookieAuthority';
import { Reply } from '../src/http/Reply';
import { Request } from '../src/http/Request';
import { Route, router } from '../src/routing/Route';

const request = (
    path: string,
    headers: Record<string, string> = {},
    method = Method.Get,
): globalThis.Request =>
    ({
        url: `http://localhost${path}`,
        method,
        headers: new Headers(headers),
    }) as unknown as globalThis.Request;

const ctx = (path: string, headers?: Record<string, string>): Request =>
    new Request(request(path, headers), null);

describe('ctx.query', () => {
    it('parses the query string into an object', () => {
        expect(ctx('/search?q=hydris&page=2').query).toEqual({
            q: 'hydris',
            page: '2',
        });
    });

    it('is empty when there is no query string', () => {
        expect(ctx('/plain').query).toEqual({});
    });

    it('decodes values and keeps the last of a repeated key', () => {
        expect(ctx('/x?a=1&a=2&b=hi%20there').query).toEqual({
            a: '2',
            b: 'hi there',
        });
    });
});

describe('ctx.cookies', () => {
    it('parses the Cookie header', () => {
        const c = ctx('/', { cookie: 'session=abc; theme=dark' });
        expect(c.cookies.get('session')).toBe('abc');
        expect(c.cookies.get('theme')).toBe('dark');
    });

    it('is empty with no Cookie header', () => {
        expect(ctx('/').cookies.size).toBe(0);
    });

    it('decodes encoded cookie values', () => {
        expect(ctx('/', { cookie: 'name=a%20b' }).cookies.get('name')).toBe(
            'a b',
        );
    });
});

describe('Reply cookies', () => {
    it('sets a Set-Cookie header with options', () => {
        const res = Reply.text('ok')
            .cookie('session', 'abc', {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 3600,
            })
            .toResponse();
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toContain('session=abc');
        expect(set).toContain('HttpOnly');
        expect(set).toContain('Secure');
        expect(set).toContain('SameSite=Lax');
        expect(set).toContain('Max-Age=3600');
        expect(set).toContain('Path=/');
    });

    it('emits a separate Set-Cookie header per cookie', () => {
        const all = Reply.text('ok')
            .cookie('a', '1')
            .cookie('b', '2')
            .toResponse()
            .headers.getSetCookie();
        expect(all.length).toBe(2);
        expect(all[0]).toContain('a=1');
        expect(all[1]).toContain('b=2');
    });

    it('clearCookie expires the cookie', () => {
        const res = Reply.text('ok').clearCookie('session').toResponse();
        expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    });
});

describe('cookie helpers', () => {
    it('serialize encodes the value and defaults Path=/', () => {
        expect(CookieAuthority.serialize('n', 'a b')).toBe('n=a%20b; Path=/');
    });

    it('parse handles null and malformed pairs', () => {
        expect(CookieAuthority.parse(null).size).toBe(0);
        const jar = CookieAuthority.parse('a=1; broken; b=2');
        expect(jar.get('a')).toBe('1');
        expect(jar.get('b')).toBe('2');
        expect(jar.has('broken')).toBe(false);
    });
});

describe('query and cookies through the router', () => {
    it('a handler reads ctx.query', async () => {
        Route.get('/e2e/query', (c) => Reply.json(c.query));
        const res = await router.dispatch(ctx('/e2e/query?x=1&y=two'));
        expect(await res.json()).toEqual({ x: '1', y: 'two' });
    });

    it('a handler reads ctx.cookies and sets one back', async () => {
        Route.get('/e2e/cookie', (c) =>
            Reply.text(c.cookies.get('in') ?? 'none').cookie('out', 'set'),
        );
        const res = await router.dispatch(
            ctx('/e2e/cookie', { cookie: 'in=value' }),
        );
        expect(await res.text()).toBe('value');
        expect(res.headers.get('set-cookie')).toContain('out=set');
    });
});
