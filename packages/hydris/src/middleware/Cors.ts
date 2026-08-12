import type { Context } from '../http/Context';
import { BaseMiddleware, type Next } from './Middleware';

export interface CorsConfig {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
}

export const defaultCorsOptions: CorsConfig = {
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400,
};

export class Cors extends BaseMiddleware {
    private readonly options: CorsConfig;

    constructor(options: Partial<CorsConfig> = {}) {
        super();
        this.options = { ...defaultCorsOptions, ...options };
    }

    handle(ctx: Context, next: Next): Response | Promise<Response> {
        const origin = ctx.req.headers.get('origin');
        return ctx.req.method === 'OPTIONS'
            ? this.preflight(ctx, origin)
            : this.decorate(next, origin);
    }

    private preflight(ctx: Context, origin: string | null): Response {
        const { methods, allowedHeaders, maxAge } = this.options;
        const headers = new Headers();

        this.applyOrigin(headers, origin);
        headers.set('Access-Control-Allow-Methods', methods.join(', '));

        const requested = ctx.req.headers.get('access-control-request-headers');
        const allowed = allowedHeaders.length
            ? allowedHeaders.join(', ')
            : requested;
        if (allowed) headers.set('Access-Control-Allow-Headers', allowed);

        headers.set('Access-Control-Max-Age', String(maxAge));
        appendVary(headers, 'Access-Control-Request-Headers');

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
                'Access-Control-Expose-Headers',
                exposedHeaders.join(', '),
            );
        }
        return res;
    }

    private applyOrigin(headers: Headers, origin: string | null): void {
        const value = this.resolveOrigin(origin);
        if (value === null) return;

        headers.set('Access-Control-Allow-Origin', value);
        if (this.options.credentials) {
            headers.set('Access-Control-Allow-Credentials', 'true');
        }
        if (value !== '*') appendVary(headers, 'Origin');
    }

    private resolveOrigin(origin: string | null): string | null {
        const { origin: allowed, credentials } = this.options;
        if (allowed === '*') return credentials ? origin : '*';
        if (origin === null) return null;

        const list = Array.isArray(allowed) ? allowed : [allowed];
        return list.includes(origin) ? origin : null;
    }
}

const appendVary = (headers: Headers, field: string): void => {
    const existing = headers.get('Vary');
    if (!existing) {
        headers.set('Vary', field);
        return;
    }
    const parts = existing.split(',').map((part) => part.trim());
    if (!parts.includes(field)) headers.set('Vary', `${existing}, ${field}`);
};
