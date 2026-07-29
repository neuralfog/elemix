import { expect, test } from '@playwright/test';

test.describe('BeforeMountApp', () => {
    test('#before-mount runs server-side, hydrates to 999, and is reactive', async ({
        page,
    }) => {
        const response = await page.goto('/before-mount-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('count is 999');

        await page.waitForFunction(
            () => !!customElements.get('before-mount-app'),
        );

        const button = page.locator('before-mount-app button');
        await expect(button).toHaveText('count is 999');

        await button.click();
        await expect(button).toHaveText('count is 1000');
        await button.click();
        await expect(button).toHaveText('count is 1001');
    });
});
