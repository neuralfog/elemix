import { describe, expect, it } from 'bun:test';
import type { Request } from '../src/http/Request';
import { Router } from '../src/routing/Router';

const req = (method: string, path: string): Request =>
    ({
        url: `http://localhost${path}`,
        method,
        headers: new Headers(),
    }) as unknown as Request;

const captureErrors = async (fn: () => Promise<void>): Promise<unknown[]> => {
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
        errors.push(args[0]);
    };
    try {
        await fn();
    } finally {
        console.error = original;
    }
    return errors;
};

describe('default error reporter', () => {
    it('logs a 5xx to console.error when no reporter is registered', async () => {
        const router = new Router();
        router.register('GET', '/boom', (): never => {
            throw new Error('kaboom');
        });
        const errors = await captureErrors(async () => {
            const res = await router.dispatch(req('GET', '/boom'));
            expect(res.status).toBe(500);
        });
        expect(errors.length).toBe(1);
        expect((errors[0] as Error).message).toBe('kaboom');
    });

    it('does not log an expected 4xx (unmatched route)', async () => {
        const router = new Router();
        const errors = await captureErrors(async () => {
            const res = await router.dispatch(req('GET', '/missing'));
            expect(res.status).toBe(404);
        });
        expect(errors.length).toBe(0);
    });

    it('defers to a registered reporter instead of the console fallback', async () => {
        const router = new Router();
        const seen: unknown[] = [];
        router.onError((error) => {
            seen.push(error);
        });
        router.register('GET', '/boom', (): never => {
            throw new Error('kaboom');
        });
        const errors = await captureErrors(async () => {
            await router.dispatch(req('GET', '/boom'));
        });
        expect(errors.length).toBe(0);
        expect(seen.length).toBe(1);
    });
});
