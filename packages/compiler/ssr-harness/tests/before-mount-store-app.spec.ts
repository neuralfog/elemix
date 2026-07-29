import { expect, test } from '@playwright/test';

test.describe('BeforeMountStoreApp', () => {
    test('#before-mount seeds a module store server-side; fresh per request; reactive after hydrate', async ({
        page,
    }) => {
        for (let reload = 0; reload < 3; reload++) {
            const response = await page.goto('/before-mount-store-app');
            const served = (await response?.text()) ?? '';
            expect(
                served,
                `reload ${reload}: server-seeded store must be fresh`,
            ).toContain('count is 999');
            expect(served).not.toContain('count is 1000');

            await page.waitForFunction(
                () => !!customElements.get('before-mount-store-app'),
            );

            const button = page.locator('before-mount-store-app button');
            await expect(button).toHaveText('count is 999');

            await button.click();
            await expect(button).toHaveText('count is 1000');
            await button.click();
            await expect(button).toHaveText('count is 1001');
        }
    });
});
