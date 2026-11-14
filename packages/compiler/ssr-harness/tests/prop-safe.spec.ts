import { expect, test } from '@playwright/test';

test.describe('prop-safe (SSR + hydrate)', () => {
    test('a scalar-only (propSafe) child keeps its props across hydration and stays reactive', async ({
        page,
    }) => {
        const response = await page.goto('/prop-safe-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('hello');

        await page.waitForFunction(
            () => !!customElements.get('prop-safe-child'),
        );
        const lbl = page.locator('prop-safe-app prop-safe-child .lbl');
        await expect(lbl).toHaveText('hello');

        await page.locator('prop-safe-app button').click();
        await expect(lbl).toHaveText('world');
    });
});
