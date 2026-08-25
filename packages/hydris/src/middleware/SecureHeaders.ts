import { Header, HeaderValue } from '../constants';
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

export class SecureHeaders extends BaseMiddleware {
    private static readonly defaults: SecureHeadersConfig = {
        contentTypeOptions: true,
        frameOptions: 'SAMEORIGIN',
        referrerPolicy: 'no-referrer',
        hsts: false,
        contentSecurityPolicy: false,
    };

    private static hstsValue(config: HstsConfig): string {
        const parts = [`max-age=${Math.floor(config.maxAge)}`];
        if (config.includeSubDomains) parts.push('includeSubDomains');
        if (config.preload) parts.push('preload');
        return parts.join('; ');
    }

    private readonly options: SecureHeadersConfig;

    constructor(options: Partial<SecureHeadersConfig> = {}) {
        super();
        this.options = { ...SecureHeaders.defaults, ...options };
    }

    async handle(_req: Request, next: Next): Promise<Response> {
        const res = await next();
        this.apply(res.headers);
        return res;
    }

    private apply(headers: Headers): void {
        const o = this.options;
        if (o.contentTypeOptions) {
            headers.set(Header.XContentTypeOptions, HeaderValue.NoSniff);
        }
        if (o.frameOptions !== false) {
            headers.set(Header.XFrameOptions, o.frameOptions);
        }
        if (o.referrerPolicy !== false) {
            headers.set(Header.ReferrerPolicy, o.referrerPolicy);
        }
        if (o.hsts !== false) {
            headers.set(
                Header.StrictTransportSecurity,
                SecureHeaders.hstsValue(o.hsts),
            );
        }
        if (o.contentSecurityPolicy !== false) {
            headers.set(Header.ContentSecurityPolicy, o.contentSecurityPolicy);
        }
    }
}
