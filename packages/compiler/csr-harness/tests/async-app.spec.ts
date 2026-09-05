import { expect, test } from '@playwright/test';

test('async-app: prepares async then bumps ticks', async ({ page }) => {
    await page.goto('/view/async-app');
    const app = page.locator('async-app');
    await expect(app).toHaveAttribute('data-prepared', 'async');
    await expect(page.locator('.phase')).toHaveText('ready');
    await expect(app).toHaveAttribute('data-phase', 'ready');
    await page.locator('.bump').click();
    await expect(page.locator('.ticks')).toHaveText('1');
});
