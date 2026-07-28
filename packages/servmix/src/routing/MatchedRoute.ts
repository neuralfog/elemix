import type { Middleware } from '../middleware/Middleware';
import type { Handler } from './HandlerDispatcher';
import type { Method } from './Method';
import type { RouteDefinition } from './RouteDefinition';

export class MatchedRoute {
    constructor(
        public readonly definition: RouteDefinition,
        public readonly params: Record<string, string> = {},
    ) {}

    param(name: string): string | undefined {
        return this.params[name];
    }

    get method(): Method {
        return this.definition.method;
    }

    get path(): string {
        return this.definition.path;
    }

    get handler(): Handler {
        return this.definition.handler;
    }

    get middlewares(): Middleware[] {
        return this.definition.middlewares;
    }
}
