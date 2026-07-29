export class UnboundTokenError extends Error {
    constructor(description: string) {
        super(`No binding registered for ${description}`);
        this.name = 'UnboundTokenError';
    }
}

export class ScopeRequiredError extends Error {
    constructor(description: string) {
        super(`${description} is scoped and requires an active request scope`);
        this.name = 'ScopeRequiredError';
    }
}

export class CircularDependencyError extends Error {
    constructor(chain: string[]) {
        super(`Circular dependency detected: ${chain.join(' -> ')}`);
        this.name = 'CircularDependencyError';
    }
}
