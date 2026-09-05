import { expect, test } from '@playwright/test';

test('plain-note: renders its plain content', async ({ page }) => {
    await page.goto('/view/plain-note');
    await expect(page.locator('.plain')).toHaveText('plain');
});
