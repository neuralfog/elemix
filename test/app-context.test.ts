import { expect, test, describe, beforeEach, vi } from 'vitest';
import { App, initApp } from '../app';

describe('App Context', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('initApp', async () => {
        const entryPoint = vi.fn();
        const cssReset = 'reset goes in here';

        initApp({
            cssReset,
            entryPoint,
        });

        expect(entryPoint).toHaveBeenCalledOnce();
        expect(App.config.cssReset).toBe(cssReset);
    });
});
