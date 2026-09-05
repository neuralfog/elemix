import { expect, test } from '@playwright/test';

test('first-widget: local state increments independently', async ({ page }) => {
    await page.goto('/view/first-widget');

    const first = page.locator('.first');
    await expect(first).toHaveText('1');
    await first.click();
    await expect(first).toHaveText('2');
});
