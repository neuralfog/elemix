import type { Method } from '../constants';
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
}
