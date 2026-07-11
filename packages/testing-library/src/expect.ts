type AnyObject = Record<string, unknown>;

const isObject = (value: unknown): value is AnyObject =>
    typeof value === 'object' && value !== null;

const deepEqual = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    if (!isObject(a) || !isObject(b)) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const aKeys = Object.keys(a);
    const bKeys = new Set(Object.keys(b));
    if (aKeys.length !== bKeys.size) return false;

    for (const key of aKeys) {
        if (!bKeys.has(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
};

const show = (value: unknown): string => {
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'function') return value.name || 'anonymous function';
    if (isObject(value)) {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

export class AssertionError extends Error {
    readonly actual?: unknown;
    readonly expected?: unknown;
    readonly showDiff?: boolean;

    constructor(
        message: string,
        diff?: { actual: unknown; expected: unknown },
    ) {
        super(message);
        this.name = 'AssertionError';
        if (diff) {
            this.actual = diff.actual;
            this.expected = diff.expected;
            this.showDiff = true;
        }
    }
}

export class Assertion<T> {
    private readonly actual: T;
    private readonly negated: boolean;

    constructor(actual: T, negated = false) {
        this.actual = actual;
        this.negated = negated;
    }

    get not(): Assertion<T> {
        return new Assertion(this.actual, !this.negated);
    }

    private run(
        pass: boolean,
        detail: string,
        diff?: { actual: unknown; expected: unknown },
    ): void {
        if (pass !== this.negated) return;
        const not = this.negated ? 'not ' : '';
        const message = `expected ${show(this.actual)} ${not}${detail}`;
        throw new AssertionError(
            message,
            diff && !this.negated ? diff : undefined,
        );
    }

    toBe(expected: T): void {
        this.run(Object.is(this.actual, expected), `to be ${show(expected)}`, {
            actual: this.actual,
            expected,
        });
    }

    toEqual(expected: T): void {
        this.run(
            deepEqual(this.actual, expected),
            `to equal ${show(expected)}`,
            {
                actual: this.actual,
                expected,
            },
        );
    }

    toContain(expected: unknown): void {
        const actual = this.actual;
        const pass =
            typeof actual === 'string'
                ? actual.includes(String(expected))
                : Array.isArray(actual) && actual.includes(expected);
        this.run(pass, `to contain ${show(expected)}`);
    }

    toBeNull(): void {
        this.run(this.actual === null, 'to be null');
    }

    toBeDefined(): void {
        this.run(this.actual !== undefined, 'to be defined');
    }

    toBeUndefined(): void {
        this.run(this.actual === undefined, 'to be undefined');
    }

    toBeTruthy(): void {
        this.run(Boolean(this.actual), 'to be truthy');
    }

    toBeFalsy(): void {
        this.run(!this.actual, 'to be falsy');
    }

    toBeGreaterThan(expected: number): void {
        this.run(
            (this.actual as number) > expected,
            `to be greater than ${expected}`,
        );
    }

    toBeGreaterThanOrEqual(expected: number): void {
        this.run(
            (this.actual as number) >= expected,
            `to be greater than or equal to ${expected}`,
        );
    }

    toBeLessThan(expected: number): void {
        this.run(
            (this.actual as number) < expected,
            `to be less than ${expected}`,
        );
    }

    toBeLessThanOrEqual(expected: number): void {
        this.run(
            (this.actual as number) <= expected,
            `to be less than or equal to ${expected}`,
        );
    }
}

export const expect = <T>(actual: T): Assertion<T> => new Assertion(actual);
