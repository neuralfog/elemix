import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context } from '../http/Context';
import { type CookieOptions, serializeCookie } from '../http/Cookie';
import type { Request } from '../http/Request';
import { BaseMiddleware, type Next } from './Middleware';

export interface CsrfOptions {
    secret: string;
    cookieName?: string;
    headerName?: string;
    fieldName?: string;
    safeMethods?: string[];
    trustedOrigins?: string[];
    cookie?: CookieOptions;
}

interface ResolvedCsrf extends Required<Omit<CsrfOptions, 'cookie'>> {
    cookie: CookieOptions;
}

const defaults: Omit<ResolvedCsrf, 'secret'> = {
    cookieName: 'csrf',
    headerName: 'x-csrf-token',
    fieldName: '_csrf',
    safeMethods: ['GET', 'HEAD', 'OPTIONS'],
    trustedOrigins: [],
    cookie: { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' },
};

export class Csrf extends BaseMiddleware {
    private readonly options: ResolvedCsrf;

    constructor(options: CsrfOptions) {
        super();
        this.options = { ...defaults, ...options };
    }

    async handle(ctx: Context, next: Next): Promise<Response> {
        const cookieToken = this.read(ctx);
        const token = cookieToken ?? this.generate();
        ctx.req.csrfToken = token;

        if (!this.options.safeMethods.includes(ctx.req.method)) {
            if (!(await this.verify(ctx, cookieToken))) {
                return new Response('Invalid CSRF token', { status: 403 });
            }
        }

        const res = await next();
        if (cookieToken === null) {
            res.headers.append(
                'Set-Cookie',
                serializeCookie(
                    this.options.cookieName,
                    `${token}.${this.sign(token)}`,
                    this.options.cookie,
                ),
            );
        }
        return res;
    }

    private read(ctx: Context): string | null {
        const raw = ctx.cookies.get(this.options.cookieName);
        if (raw === undefined) return null;
        const dot = raw.lastIndexOf('.');
        if (dot === -1) return null;
        const token = raw.slice(0, dot);
        return equal(raw.slice(dot + 1), this.sign(token)) ? token : null;
    }

    private async verify(
        ctx: Context,
        cookieToken: string | null,
    ): Promise<boolean> {
        if (cookieToken === null) return false;
        if (!this.originAllowed(ctx)) return false;
        const submitted = await this.submitted(ctx.req);
        return submitted !== null && equal(submitted, cookieToken);
    }

    private originAllowed(ctx: Context): boolean {
        if (this.options.trustedOrigins.length === 0) return true;
        const origin = ctx.req.headers.get('origin');
        if (origin === null) return true;
        return this.options.trustedOrigins.includes(origin);
    }

    private async submitted(req: Request): Promise<string | null> {
        const header = req.headers.get(this.options.headerName);
        if (header) return header;

        const type = req.headers.get('content-type') ?? '';
        if (
            type.includes('form-urlencoded') ||
            type.includes('multipart/form-data')
        ) {
            try {
                const form = await req.clone().formData();
                const value = form.get(this.options.fieldName);
                return typeof value === 'string' ? value : null;
            } catch {
                return null;
            }
        }
        return null;
    }

    private sign(token: string): string {
        return createHmac('sha256', this.options.secret)
            .update(token)
            .digest('base64url');
    }

    private generate(): string {
        return randomBytes(32).toString('base64url');
    }
}

const equal = (a: string, b: string): boolean => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
};
