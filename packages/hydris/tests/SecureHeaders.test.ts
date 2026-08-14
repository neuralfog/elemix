import { describe, expect, it } from 'bun:test';
import type { Request } from '../src/http/Request';
import type { Next } from '../src/middleware/Middleware';
import { SecureHeaders } from '../src/middleware/SecureHeaders';

const ok: Next = async () => new Response('ok', { status: 200 });
const run = (mw: SecureHeaders): Promise<Response> =>
    mw.handle({} as Request, ok);

describe('SecureHeaders', () => {
    it('sets the safe defaults', async () => {
        const res = await run(new SecureHeaders());
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
        expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
        expect(res.headers.get('Strict-Transport-Security')).toBeNull();
        expect(res.headers.get('Content-Security-Policy')).toBeNull();
    });

    it('honours overrides and disabling via false', async () => {
        const res = await run(
            new SecureHeaders({
                frameOptions: 'DENY',
                referrerPolicy: false,
                contentTypeOptions: false,
            }),
        );
        expect(res.headers.get('X-Frame-Options')).toBe('DENY');
        expect(res.headers.get('Referrer-Policy')).toBeNull();
        expect(res.headers.get('X-Content-Type-Options')).toBeNull();
    });

    it('emits HSTS with directives when opted in', async () => {
        const res = await run(
            new SecureHeaders({
                hsts: {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true,
                },
            }),
        );
        expect(res.headers.get('Strict-Transport-Security')).toBe(
            'max-age=31536000; includeSubDomains; preload',
        );
    });

    it('emits a CSP when opted in', async () => {
        const res = await run(
            new SecureHeaders({ contentSecurityPolicy: "default-src 'self'" }),
        );
        expect(res.headers.get('Content-Security-Policy')).toBe(
            "default-src 'self'",
        );
    });
});
