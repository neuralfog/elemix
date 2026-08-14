import type { Request } from '../http/Request';
import { BaseMiddleware, type Next } from './Middleware';

export type HstsConfig = {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
};

export type SecureHeadersConfig = {
    contentTypeOptions: boolean;
    frameOptions: 'DENY' | 'SAMEORIGIN' | false;
    referrerPolicy: string | false;
    hsts: HstsConfig | false;
    contentSecurityPolicy: string | false;
};

export const defaultSecureHeaders: SecureHeadersConfig = {
    contentTypeOptions: true,
    frameOptions: 'SAMEORIGIN',
    referrerPolicy: 'no-referrer',
    hsts: false,
    contentSecurityPolicy: false,
};

export class SecureHeaders extends BaseMiddleware {
    private readonly options: SecureHeadersConfig;

    constructor(options: Partial<SecureHeadersConfig> = {}) {
        super();
        this.options = { ...defaultSecureHeaders, ...options };
    }

    async handle(_req: Request, next: Next): Promise<Response> {
        const res = await next();
        this.apply(res.headers);
        return res;
    }

    private apply(headers: Headers): void {
        const o = this.options;
        if (o.contentTypeOptions) {
            headers.set('X-Content-Type-Options', 'nosniff');
        }
        if (o.frameOptions !== false) {
            headers.set('X-Frame-Options', o.frameOptions);
        }
        if (o.referrerPolicy !== false) {
            headers.set('Referrer-Policy', o.referrerPolicy);
        }
        if (o.hsts !== false) {
            headers.set('Strict-Transport-Security', hstsValue(o.hsts));
        }
        if (o.contentSecurityPolicy !== false) {
            headers.set('Content-Security-Policy', o.contentSecurityPolicy);
        }
    }
}

const hstsValue = (config: HstsConfig): string => {
    const parts = [`max-age=${Math.floor(config.maxAge)}`];
    if (config.includeSubDomains) parts.push('includeSubDomains');
    if (config.preload) parts.push('preload');
    return parts.join('; ');
};
