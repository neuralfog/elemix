import type { MatchedRoute } from '../routing/MatchedRoute';
import type { Request } from './Request';

export class Context<T = Record<string, unknown>> {
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
