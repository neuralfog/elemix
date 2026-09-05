import { expect, test } from '@playwright/test';

test('method-app: method bumps count', async ({ page }) => {
    await page.goto('/view/method-app');
    await expect(page.locator('.lbl')).toHaveText('count');
    await expect(page.locator('.count')).toHaveText('0');
    await page.locator('.inc').click();
    await expect(page.locator('.count')).toHaveText('1');
});
