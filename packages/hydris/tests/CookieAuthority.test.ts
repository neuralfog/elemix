import { beforeEach, describe, expect, it } from 'bun:test';
import { CookieAuthority } from '../src/http/CookieAuthority';
import { Request } from '../src/http/Request';

const reqWith = (cookie: string): Request =>
    new Request(
        new globalThis.Request('http://localhost/', {
            headers: cookie ? { cookie } : {},
        }),
    );

const authFor = (cookie: string): CookieAuthority =>
    new CookieAuthority(reqWith(cookie));

describe('CookieAuthority', () => {
    beforeEach(() => CookieAuthority.secret('unit-secret'));

    it('signs then reads the value back from the request', () => {
        const signed = authFor('').sign('sid', 'abc123');
        expect(signed.startsWith('abc123.')).toBe(true);
        expect(authFor(`sid=${encodeURIComponent(signed)}`).get('sid')).toBe(
            'abc123',
        );
    });

    it('returns null for a missing cookie', () => {
        expect(authFor('').get('sid')).toBeNull();
    });

    it('rejects a tampered value', () => {
        const signed = authFor('').sign('sid', 'abc123');
        const dot = signed.lastIndexOf('.');
        const tampered = `abc124${signed.slice(dot)}`;
        expect(
            authFor(`sid=${encodeURIComponent(tampered)}`).get('sid'),
        ).toBeNull();
    });

    it('binds the signature to the cookie name', () => {
        const signed = authFor('').sign('sid', 'abc123');
        expect(
            authFor(`other=${encodeURIComponent(signed)}`).get('other'),
        ).toBeNull();
    });

    it('rejects a value signed with a different secret', () => {
        CookieAuthority.secret('secret-a');
        const signed = authFor('').sign('sid', 'v');
        CookieAuthority.secret('secret-b');
        expect(
            authFor(`sid=${encodeURIComponent(signed)}`).get('sid'),
        ).toBeNull();
    });

    it('throws when signing with no secret configured', () => {
        CookieAuthority.secret('');
        expect(() => authFor('').sign('sid', 'x')).toThrow(/secret/);
    });

    it('writes a signed Set-Cookie that reads back and carries options', () => {
        const res = new Response('ok');
        authFor('').setCookie(res, 'sid', 'v', { httpOnly: true });
        const set = res.headers.get('set-cookie') ?? '';
        expect(set).toContain('HttpOnly');
        const value = /sid=([^;]+)/.exec(set)?.[1] ?? '';
        expect(authFor(`sid=${value}`).get('sid')).toBe('v');
    });

    it('reads store cookies with hardening, ignoring unsafe names', () => {
        const cookie = [
            `store.prefs=${encodeURIComponent(JSON.stringify({ theme: 'dark' }))}`,
            `store.__proto__=${encodeURIComponent(JSON.stringify({ bad: 1 }))}`,
            'session=nope',
        ].join('; ');
        const seed = authFor(cookie).stores();
        expect(seed).toEqual({ prefs: { theme: 'dark' } });
        expect(Object.getPrototypeOf(seed)).toBe(Object.prototype);
    });

    it('drops prototype-polluting keys from a store payload', () => {
        const cookie = `store.prefs=${encodeURIComponent(
            '{"__proto__":{"x":1},"theme":"dark"}',
        )}`;
        expect(authFor(cookie).stores().prefs).toEqual({ theme: 'dark' });
    });
});
