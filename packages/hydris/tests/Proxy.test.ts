import { describe, expect, it } from 'bun:test';
import { Context } from '../src/http/Context';
import { resolveIp, resolveProtocol } from '../src/http/proxy';
import type { Request } from '../src/http/Request';

const request = (url: string, headers: Record<string, string> = {}): Request =>
    ({
        url: `http://localhost${url}`,
        method: 'GET',
        headers: new Headers(headers),
    }) as unknown as Request;

describe('resolveIp', () => {
    it('returns the socket ip when proxy is not trusted', () => {
        const req = request('/', { 'x-forwarded-for': '203.0.113.7' });
        expect(resolveIp(req, '10.0.0.1', false)).toBe('10.0.0.1');
    });

    it('returns the first X-Forwarded-For hop when trusted', () => {
        const req = request('/', {
            'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        });
        expect(resolveIp(req, '10.0.0.1', true)).toBe('203.0.113.7');
    });

    it('falls back to the socket ip when trusted but header absent', () => {
        expect(resolveIp(request('/'), '10.0.0.1', true)).toBe('10.0.0.1');
    });

    it('prefers CF-Connecting-IP over X-Forwarded-For behind Cloudflare', () => {
        const req = request('/', {
            'cf-connecting-ip': '203.0.113.7',
            'x-forwarded-for': '198.51.100.1, 172.16.0.1',
        });
        expect(resolveIp(req, '10.0.0.1', true)).toBe('203.0.113.7');
    });

    it('uses True-Client-IP when CF-Connecting-IP is absent', () => {
        const req = request('/', {
            'true-client-ip': '203.0.113.9',
            'x-forwarded-for': '198.51.100.1',
        });
        expect(resolveIp(req, '10.0.0.1', true)).toBe('203.0.113.9');
    });

    it('ignores Cloudflare headers when proxy is not trusted', () => {
        const req = request('/', { 'cf-connecting-ip': '203.0.113.7' });
        expect(resolveIp(req, '10.0.0.1', false)).toBe('10.0.0.1');
    });
});

describe('resolveProtocol', () => {
    it('derives from the url when proxy is not trusted', () => {
        const req = request('/', { 'x-forwarded-proto': 'https' });
        expect(resolveProtocol(req, false)).toBe('http');
    });

    it('uses X-Forwarded-Proto when trusted', () => {
        const req = request('/', { 'x-forwarded-proto': 'https' });
        expect(resolveProtocol(req, true)).toBe('https');
    });
});

describe('ctx.ip and ctx.protocol', () => {
    it('read resolved values off the request', () => {
        const req = request('/');
        req.ip = '203.0.113.7';
        req.protocol = 'https';
        const ctx = new Context(req, null);
        expect(ctx.ip).toBe('203.0.113.7');
        expect(ctx.protocol).toBe('https');
    });

    it('default to empty ip and url-derived protocol when unresolved', () => {
        const ctx = new Context(request('/'), null);
        expect(ctx.ip).toBe('');
        expect(ctx.protocol).toBe('http');
    });
});
