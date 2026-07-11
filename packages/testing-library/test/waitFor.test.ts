import { describe, expect, it } from 'vitest';
import { waitFor } from '../src/waitFor';

describe('waitFor', () => {
    it('resolves immediately when the callback passes', async () => {
        const value = await waitFor(() => 42);
        expect(value).toBe(42);
    });

    it('retries until the callback stops throwing', async () => {
        let calls = 0;
        const value = await waitFor(
            () => {
                calls++;
                if (calls < 3) throw new Error('not yet');
                return calls;
            },
            { interval: 5 },
        );
        expect(value).toBe(3);
    });

    it('resolves a settling condition', async () => {
        let ready = false;
        setTimeout(() => {
            ready = true;
        }, 20);
        await waitFor(
            () => {
                if (!ready) throw new Error('pending');
            },
            { interval: 5 },
        );
        expect(ready).toBe(true);
    });

    it('rejects with the last error after the timeout', async () => {
        await expect(
            waitFor(
                () => {
                    throw new Error('always failing');
                },
                { timeout: 30, interval: 5 },
            ),
        ).rejects.toThrow('always failing');
    });

    it('awaits async callbacks', async () => {
        const value = await waitFor(async () => 'done');
        expect(value).toBe('done');
    });
});
