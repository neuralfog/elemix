import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '../error/HttpException';
import type { CookieAuthority, CookieOptions } from '../http/CookieAuthority';
import { Header, Method } from '../constants';
import type { Request } from '../http/Request';
import { BaseMiddleware, type Next } from './Middleware';

export type CsrfOptions = {
    cookieName?: string;
    headerName?: string;
    fieldName?: string;
    safeMethods?: string[];
    trustedOrigins?: string[];
    cookie?: CookieOptions;
};

type ResolvedCsrf = Required<Omit<CsrfOptions, 'cookie'>> & {
    cookie: CookieOptions;
};

export class Csrf extends BaseMiddleware {
    private static readonly defaults: ResolvedCsrf = {
        cookieName: 'csrf',
        headerName: Header.XCsrfToken,
        fieldName: '_csrf',
        safeMethods: [Method.Get, Method.Head, Method.Options],
        trustedOrigins: [],
        cookie: { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' },
    };

    private static stored: CsrfOptions = {};

    static config(options: CsrfOptions): void {
        Csrf.stored = options;
    }

    private static equal(a: string, b: string): boolean {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        return left.length === right.length && timingSafeEqual(left, right);
    }

    private readonly options: ResolvedCsrf;

    constructor(private readonly cookies: CookieAuthority) {
        super();
        this.options = { ...Csrf.defaults, ...Csrf.stored };
    }

    async handle(req: Request, next: Next): Promise<Response> {
        const cookieToken = this.cookies.get(this.options.cookieName);
        const token = cookieToken ?? this.generate();
        req.csrf = token;

        if (
            !this.options.safeMethods.includes(req.method) &&
            !(await this.verify(req, cookieToken))
        ) {
            throw new ForbiddenException('Invalid CSRF token');
        }

        const res = await next();
        if (cookieToken === null) {
            this.cookies.setCookie(
                res,
                this.options.cookieName,
                token,
                this.options.cookie,
            );
        }
        return res;
    }

    private async verify(
        req: Request,
        cookieToken: string | null,
    ): Promise<boolean> {
        if (cookieToken === null) return false;
        if (!this.originAllowed(req)) return false;
        const submitted = await this.submitted(req);
        return submitted !== null && Csrf.equal(submitted, cookieToken);
    }

    private originAllowed(req: Request): boolean {
        if (this.options.trustedOrigins.length === 0) return true;
        const origin = req.headers.get(Header.Origin);
        if (origin === null) return true;
        return this.options.trustedOrigins.includes(origin);
    }

    private async submitted(req: Request): Promise<string | null> {
        const header = req.headers.get(this.options.headerName);
        if (header) return header;

        const type = req.headers.get(Header.ContentType) ?? '';
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

    private generate(): string {
        return randomBytes(32).toString('base64url');
    }
}
