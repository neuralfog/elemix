declare const TYPE: unique symbol;

export type Token<T> = {
    readonly [TYPE]: T;
    readonly description: string;
};

export type Ctor<T> = new (...args: never[]) => T;

export type TokenLike<T> = Token<T> | Ctor<T>;

export class Tokens {
    static create<T>(description: string): Token<T> {
        return { description } as unknown as Token<T>;
    }

    static describe(token: unknown): string {
        if (typeof token === 'function') return token.name || 'anonymous class';
        if (token && typeof token === 'object' && 'description' in token) {
            return String((token as { description: unknown }).description);
        }
        return 'unknown token';
    }
}
