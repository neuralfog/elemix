import type { MatchedRoute } from '../routing/MatchedRoute';
import { parseCookies } from './Cookie';
import type { Request } from './Request';

export class Context<T = Record<string, unknown>> {
    private queryCache?: Record<string, string>;
    private cookieCache?: Map<string, string>;

    constructor(
        public readonly req: Request<T>,
        public readonly route: MatchedRoute | null,
    ) {}

    param(name: string): string | undefined {
        return this.route?.param(name);
    }

    get params(): Record<string, string> {
        return this.route?.params ?? {};
    }

    get query(): Record<string, string> {
        if (this.queryCache === undefined) {
            const out: Record<string, string> = {};
            for (const [key, value] of new URL(this.req.url).searchParams) {
                out[key] = value;
            }
            this.queryCache = out;
        }
        return this.queryCache;
    }

    get cookies(): Map<string, string> {
        if (this.cookieCache === undefined) {
            this.cookieCache = parseCookies(this.req.headers.get('cookie'));
        }
        return this.cookieCache;
    }

    get ip(): string {
        return this.req.ip ?? '';
    }

    get protocol(): string {
        return (
            this.req.protocol ?? new URL(this.req.url).protocol.replace(':', '')
        );
    }

    get csrf(): string {
        return this.req.csrfToken ?? '';
    }

    get id(): string {
        return this.req.id;
    }

    get bag(): T {
        return this.req.bag;
    }

    json<B = unknown>(): Promise<B> {
        return this.req.json() as Promise<B>;
    }

    text(): Promise<string> {
        return this.req.text();
    }

    form(): Promise<FormData> {
        return this.req.formData();
    }
}
