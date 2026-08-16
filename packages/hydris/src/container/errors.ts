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

export class ForbiddenDependencyError extends Error {
    readonly context: string;
    readonly chain: string[];
    constructor(context: string, chain: string[], hint?: string) {
        const base = `Cannot resolve ${chain.join(' -> ')}: this scope has no '${context}' context`;
        super(hint === undefined ? base : `${base} (${hint})`);
        this.name = 'ForbiddenDependencyError';
        this.context = context;
        this.chain = chain;
    }
}
