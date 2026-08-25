import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { App } from '../src/App';
import { UnhandledErrors } from '../src/error/UnhandledErrors';

describe('App.onUnhandled', () => {
    afterEach(() => {
        UnhandledErrors.setHandler((error) => {
            console.error(error);
        });
    });

    it('routes an unhandled error to a custom handler', () => {
        const seen: unknown[] = [];
        App.onUnhandled((error) => seen.push(error));

        const err = new Error('boom');
        UnhandledErrors.handle(err);

        expect(seen).toEqual([err]);
    });

    it('lets the custom handler be replaced', () => {
        const first: unknown[] = [];
        const second: unknown[] = [];
        App.onUnhandled((error) => first.push(error));
        App.onUnhandled((error) => second.push(error));

        const err = new Error('again');
        UnhandledErrors.handle(err);

        expect(first).toEqual([]);
        expect(second).toEqual([err]);
    });

    it('defaults to console.error when no handler is registered', () => {
        const spy = spyOn(console, 'error').mockImplementation(() => {});
        const err = new Error('default');
        UnhandledErrors.handle(err);
        expect(spy).toHaveBeenCalledWith(err);
        spy.mockRestore();
    });
});
