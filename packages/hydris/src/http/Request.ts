import type { MatchedRoute } from '../routing/MatchedRoute';
import { CookieAuthority } from './CookieAuthority';
import { Header } from '../constants';

export class Request<T = Record<string, unknown>> {
    id = '';
    bag: T;
    csrf = '';
    route: MatchedRoute | null;

    private ipValue?: string;
    private protocolValue?: string;
    private queryCache?: Record<string, string>;
    private cookieCache?: Map<string, string>;

    constructor(
        readonly raw: globalThis.Request,
        route: MatchedRoute | null = null,
    ) {
        this.route = route;
        this.bag = {} as T;
    }

    get method(): string {
        return this.raw.method;
    }

    get url(): string {
        return this.raw.url;
    }

    get headers(): Headers {
        return this.raw.headers;
    }

    json<B = unknown>(): Promise<B> {
        return this.raw.json() as Promise<B>;
    }

    form(): Promise<FormData> {
        return this.raw.formData();
    }

    text(): Promise<string> {
        return this.raw.text();
    }

    clone(): globalThis.Request {
        return this.raw.clone();
    }

    param(name: string): string | undefined {
        return this.route?.param(name);
    }

    get params(): Record<string, string> {
        return this.route?.params ?? {};
    }

    get query(): Record<string, string> {
        if (this.queryCache === undefined) {
            const out: Record<string, string> = {};
            for (const [key, value] of new URL(this.raw.url).searchParams) {
                out[key] = value;
            }
            this.queryCache = out;
        }
        return this.queryCache;
    }

    get cookies(): Map<string, string> {
        if (this.cookieCache === undefined) {
            this.cookieCache = CookieAuthority.parse(
                this.raw.headers.get(Header.Cookie),
            );
        }
        return this.cookieCache;
    }

    get ip(): string {
        return this.ipValue ?? '';
    }

    set ip(value: string) {
        this.ipValue = value;
    }

    get protocol(): string {
        return (
            this.protocolValue ??
            new URL(this.raw.url).protocol.replace(':', '')
        );
    }

    set protocol(value: string) {
        this.protocolValue = value;
    }
}
