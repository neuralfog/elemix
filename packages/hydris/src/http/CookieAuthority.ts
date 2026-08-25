import { createHmac, timingSafeEqual } from 'node:crypto';
import { Header } from '../constants';
import type { Request } from './Request';

export type CookieOptions = {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
};

export class CookieAuthority {
    private static configuredSecret: string | undefined;
    private static readonly STORE_PREFIX = 'store.';
    private static readonly STORE_MAX_BYTES = 4096;
    private static readonly UNSAFE_KEYS = new Set([
        '__proto__',
        'constructor',
        'prototype',
    ]);
    private static readonly NO_SECRET =
        'CookieAuthority: no cookie signing secret configured. Set one with CookieAuthority.secret(value) before signing or reading signed cookies.';

    static secret(value: string): void {
        CookieAuthority.configuredSecret = value;
    }

    static parse(header: string | null): Map<string, string> {
        const jar = new Map<string, string>();
        if (!header) return jar;
        for (const part of header.split(';')) {
            const eq = part.indexOf('=');
            if (eq === -1) continue;
            const name = part.slice(0, eq).trim();
            if (name === '') continue;
            jar.set(name, decodeURIComponent(part.slice(eq + 1).trim()));
        }
        return jar;
    }

    static serialize(
        name: string,
        value: string,
        options: CookieOptions = {},
    ): string {
        const parts = [`${name}=${encodeURIComponent(value)}`];
        if (options.maxAge !== undefined) {
            parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
        }
        if (options.expires !== undefined) {
            parts.push(`Expires=${options.expires.toUTCString()}`);
        }
        parts.push(`Path=${options.path ?? '/'}`);
        if (options.domain !== undefined)
            parts.push(`Domain=${options.domain}`);
        if (options.secure) parts.push('Secure');
        if (options.httpOnly) parts.push('HttpOnly');
        if (options.sameSite !== undefined) {
            parts.push(`SameSite=${options.sameSite}`);
        }
        return parts.join('; ');
    }

    private static dropUnsafe(key: string, value: unknown): unknown {
        return CookieAuthority.UNSAFE_KEYS.has(key) ? undefined : value;
    }

    private static equal(a: string, b: string): boolean {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        return left.length === right.length && timingSafeEqual(left, right);
    }

    constructor(private readonly request: Request<unknown>) {}

    private requireSecret(): string {
        const secret = CookieAuthority.configuredSecret;
        if (secret === undefined || secret.length === 0) {
            throw new Error(CookieAuthority.NO_SECRET);
        }
        return secret;
    }

    private mac(name: string, value: string): string {
        return createHmac('sha256', this.requireSecret())
            .update(name)
            .update('\x00')
            .update(value)
            .digest('base64url');
    }

    sign(name: string, value: string): string {
        return `${value}.${this.mac(name, value)}`;
    }

    setCookie(
        res: Response,
        name: string,
        value: string,
        options?: CookieOptions,
    ): void {
        res.headers.append(
            Header.SetCookie,
            CookieAuthority.serialize(name, this.sign(name, value), options),
        );
    }

    get(name: string): string | null {
        const signed = this.request.cookies.get(name);
        if (signed === undefined) return null;
        const dot = signed.lastIndexOf('.');
        if (dot === -1) return null;
        const value = signed.slice(0, dot);
        return CookieAuthority.equal(
            signed.slice(dot + 1),
            this.mac(name, value),
        )
            ? value
            : null;
    }

    stores(): Record<string, unknown> {
        const seed: Record<string, unknown> = {};
        for (const [name, value] of this.request.cookies) {
            if (!name.startsWith(CookieAuthority.STORE_PREFIX)) continue;
            const key = name.slice(CookieAuthority.STORE_PREFIX.length);
            if (
                CookieAuthority.UNSAFE_KEYS.has(key) ||
                value.length > CookieAuthority.STORE_MAX_BYTES
            ) {
                continue;
            }
            try {
                const parsed = JSON.parse(value, CookieAuthority.dropUnsafe);
                if (
                    parsed !== null &&
                    typeof parsed === 'object' &&
                    !Array.isArray(parsed)
                ) {
                    seed[key] = parsed;
                }
            } catch {}
        }
        return seed;
    }
}
