import { expect, test, describe, beforeEach, vi } from 'vitest';
import { App, initApp } from '../app';
import { makeCssStylesheet } from '../utilities';

describe('App Context', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('initApp', async () => {
        const entryPoint = vi.fn();
        const baseStyles = [makeCssStylesheet('body { color: white; }')];

        initApp({
            baseStyles,
            entryPoint,
        });

        expect(entryPoint).toHaveBeenCalledOnce();
        expect(App.config.baseStyles).toBe(baseStyles);
    });
});
