import { expect, test } from '@playwright/test';

test('before-mount-app: seeds count from before-mount hook', async ({
    page,
}) => {
    await page.goto('/view/before-mount-app');
    const button = page.locator('button');
    await expect(button).toHaveText('count is 999');
    await button.click();
    await expect(button).toHaveText('count is 1000');
    await button.click();
    await expect(button).toHaveText('count is 1001');
});
