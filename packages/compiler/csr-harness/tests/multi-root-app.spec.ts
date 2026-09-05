import { expect, test } from '@playwright/test';

test('multi-root-app: increments the first root only', async ({ page }) => {
    await page.goto('/view/multi-root-app');

    await expect(page.locator('.a')).toHaveText('a0');
    await expect(page.locator('.b')).toHaveText('b');

    await page.locator('.inc').click();
    await expect(page.locator('.a')).toHaveText('a1');
    await expect(page.locator('.b')).toHaveText('b');
});
