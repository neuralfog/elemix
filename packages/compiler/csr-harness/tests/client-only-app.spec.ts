import { expect, test } from '@playwright/test';

test('client-only-app: increments count', async ({ page }) => {
    await page.goto('/view/client-only-app');
    const button = page.locator('button');
    await expect(button).toHaveText('count is 7');
    await button.click();
    await expect(button).toHaveText('count is 8');
    await button.click();
    await expect(button).toHaveText('count is 9');
});
