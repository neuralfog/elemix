import { describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { ProxyResolver } from '../src/http/ProxyResolver';
import { Request } from '../src/http/Request';

const request = (url: string, headers: Record<string, string> = {}): Request =>
    new Request({
        url: `http://localhost${url}`,
        method: Method.Get,
        headers: new Headers(headers),
    } as unknown as globalThis.Request);

describe('resolveIp', () => {
    it('returns the socket ip when proxy is not trusted', () => {
        const req = request('/', { 'x-forwarded-for': '203.0.113.7' });
        expect(ProxyResolver.resolveIp(req, '10.0.0.1', false)).toBe(
            '10.0.0.1',
        );
    });

    it('returns the first X-Forwarded-For hop when trusted', () => {
        const req = request('/', {
            'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        });
        expect(ProxyResolver.resolveIp(req, '10.0.0.1', true)).toBe(
            '203.0.113.7',
        );
    });

    it('falls back to the socket ip when trusted but header absent', () => {
        expect(ProxyResolver.resolveIp(request('/'), '10.0.0.1', true)).toBe(
            '10.0.0.1',
        );
    });

    it('prefers CF-Connecting-IP over X-Forwarded-For behind Cloudflare', () => {
        const req = request('/', {
            'cf-connecting-ip': '203.0.113.7',
            'x-forwarded-for': '198.51.100.1, 172.16.0.1',
        });
        expect(ProxyResolver.resolveIp(req, '10.0.0.1', true)).toBe(
            '203.0.113.7',
        );
    });

    it('uses True-Client-IP when CF-Connecting-IP is absent', () => {
        const req = request('/', {
            'true-client-ip': '203.0.113.9',
            'x-forwarded-for': '198.51.100.1',
        });
        expect(ProxyResolver.resolveIp(req, '10.0.0.1', true)).toBe(
            '203.0.113.9',
        );
    });

    it('ignores Cloudflare headers when proxy is not trusted', () => {
        const req = request('/', { 'cf-connecting-ip': '203.0.113.7' });
        expect(ProxyResolver.resolveIp(req, '10.0.0.1', false)).toBe(
            '10.0.0.1',
        );
    });
});

describe('resolveProtocol', () => {
    it('derives from the url when proxy is not trusted', () => {
        const req = request('/', { 'x-forwarded-proto': 'https' });
        expect(ProxyResolver.resolveProtocol(req, false)).toBe('http');
    });

    it('uses X-Forwarded-Proto when trusted', () => {
        const req = request('/', { 'x-forwarded-proto': 'https' });
        expect(ProxyResolver.resolveProtocol(req, true)).toBe('https');
    });
});

describe('request.ip and request.protocol', () => {
    it('read resolved values off the request', () => {
        const req = request('/');
        req.ip = '203.0.113.7';
        req.protocol = 'https';
        expect(req.ip).toBe('203.0.113.7');
        expect(req.protocol).toBe('https');
    });

    it('default to empty ip and url-derived protocol when unresolved', () => {
        const req = request('/');
        expect(req.ip).toBe('');
        expect(req.protocol).toBe('http');
    });
});
