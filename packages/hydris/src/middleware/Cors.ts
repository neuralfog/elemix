import { token } from '../container/Token';
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

export const CorsConfig = token<CorsConfig>('CorsConfig');

export const defaultCorsOptions: CorsConfig = {
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400,
};

export class Cors extends BaseMiddleware {
    constructor(private readonly options: CorsConfig) {
        super();
    }

    async handle(ctx: Context, next: Next): Promise<Response> {
        const requestOrigin = ctx.req.headers.get('origin');

        if (ctx.req.method === 'OPTIONS') {
            const headers = new Headers();
            this.applyOrigin(headers, requestOrigin);
            headers.set(
                'Access-Control-Allow-Methods',
                this.options.methods.join(', '),
            );
            const requested = ctx.req.headers.get(
                'access-control-request-headers',
            );
            const allowed =
                this.options.allowedHeaders.length > 0
                    ? this.options.allowedHeaders.join(', ')
                    : requested;
            if (allowed) headers.set('Access-Control-Allow-Headers', allowed);
            headers.set('Access-Control-Max-Age', String(this.options.maxAge));
            this.appendVary(headers, 'Access-Control-Request-Headers');
            return new Response(null, { status: 204, headers });
        }

        const res = await next();
        this.applyOrigin(res.headers, requestOrigin);
        if (this.options.exposedHeaders.length > 0) {
            res.headers.set(
                'Access-Control-Expose-Headers',
                this.options.exposedHeaders.join(', '),
            );
        }
        return res;
    }

    private applyOrigin(headers: Headers, requestOrigin: string | null): void {
        const value = this.resolveOrigin(requestOrigin);
        if (value === null) return;
        headers.set('Access-Control-Allow-Origin', value);
        if (this.options.credentials) {
            headers.set('Access-Control-Allow-Credentials', 'true');
        }
        if (value !== '*') this.appendVary(headers, 'Origin');
    }

    private resolveOrigin(requestOrigin: string | null): string | null {
        const { origin, credentials } = this.options;
        if (origin === '*') return credentials ? requestOrigin : '*';
        if (requestOrigin === null) return null;
        if (Array.isArray(origin)) {
            return origin.includes(requestOrigin) ? requestOrigin : null;
        }
        return origin === requestOrigin ? requestOrigin : null;
    }

    private appendVary(headers: Headers, field: string): void {
        const existing = headers.get('Vary');
        if (!existing) {
            headers.set('Vary', field);
            return;
        }
        const parts = existing.split(',').map((part) => part.trim());
        if (!parts.includes(field)) {
            headers.set('Vary', `${existing}, ${field}`);
        }
    }
}

Object.defineProperty(Cors, Symbol.for('ssr.inject'), {
    value: [CorsConfig],
});
