import { Header, HeaderValue, Method } from '../constants';
import type { Request } from '../http/Request';
import { BaseMiddleware, type Next } from './Middleware';

export type CorsConfig = {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
};

export class Cors extends BaseMiddleware {
    private static readonly defaults: CorsConfig = {
        origin: '*',
        methods: [
            Method.Get,
            Method.Head,
            Method.Post,
            Method.Put,
            Method.Patch,
            Method.Delete,
            Method.Options,
        ],
        allowedHeaders: [],
        exposedHeaders: [],
        credentials: false,
        maxAge: 86400,
    };

    private static appendVary(headers: Headers, field: string): void {
        const existing = headers.get(Header.Vary);
        if (!existing) {
            headers.set(Header.Vary, field);
            return;
        }
        const parts = existing.split(',').map((part) => part.trim());
        if (!parts.includes(field)) {
            headers.set(Header.Vary, `${existing}, ${field}`);
        }
    }

    private readonly options: CorsConfig;

    constructor(options: Partial<CorsConfig> = {}) {
        super();
        this.options = { ...Cors.defaults, ...options };
    }

    handle(req: Request, next: Next): Response | Promise<Response> {
        const origin = req.headers.get(Header.Origin);
        return req.method === Method.Options
            ? this.preflight(req, origin)
            : this.decorate(next, origin);
    }

    private preflight(req: Request, origin: string | null): Response {
        const { methods, allowedHeaders, maxAge } = this.options;
        const headers = new Headers();

        this.applyOrigin(headers, origin);
        headers.set(Header.AccessControlAllowMethods, methods.join(', '));

        const requested = req.headers.get(Header.AccessControlRequestHeaders);
        const allowed = allowedHeaders.length
            ? allowedHeaders.join(', ')
            : requested;
        if (allowed) headers.set(Header.AccessControlAllowHeaders, allowed);

        headers.set(Header.AccessControlMaxAge, String(maxAge));
        Cors.appendVary(headers, Header.AccessControlRequestHeaders);

        return new Response(null, { status: 204, headers });
    }

    private async decorate(
        next: Next,
        origin: string | null,
    ): Promise<Response> {
        const res = await next();
        const { exposedHeaders } = this.options;

        this.applyOrigin(res.headers, origin);
        if (exposedHeaders.length) {
            res.headers.set(
                Header.AccessControlExposeHeaders,
                exposedHeaders.join(', '),
            );
        }
        return res;
    }

    private applyOrigin(headers: Headers, origin: string | null): void {
        const value = this.resolveOrigin(origin);
        if (value === null) return;

        headers.set(Header.AccessControlAllowOrigin, value);
        if (this.options.credentials) {
            headers.set(Header.AccessControlAllowCredentials, HeaderValue.True);
        }
        if (value !== '*') Cors.appendVary(headers, Header.Origin);
    }

    private resolveOrigin(origin: string | null): string | null {
        const { origin: allowed, credentials } = this.options;
        if (allowed === '*') return credentials ? origin : '*';
        if (origin === null) return null;

        const list = Array.isArray(allowed) ? allowed : [allowed];
        return list.includes(origin) ? origin : null;
    }
}
