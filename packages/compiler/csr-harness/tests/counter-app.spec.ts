import { expect, test } from '@playwright/test';

test('counter-app: button increments count', async ({ page }) => {
    await page.goto('/view/counter-app');
    const button = page.locator('button');
    await expect(button).toHaveText('count is 0');
    for (let i = 1; i <= 4; i++) {
        await button.click();
        await expect(button).toHaveText(`count is ${i}`);
    }
});
