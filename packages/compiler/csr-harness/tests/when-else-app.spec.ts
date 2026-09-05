import { expect, test } from '@playwright/test';

test('when-else-app: toggles between idle and ready', async ({ page }) => {
    await page.goto('/view/when-else-app');
    await expect(page.locator('.card.idle')).toContainText('Please log in');
    await expect(page.locator('.card.ready')).toHaveCount(0);

    await page.locator('.toggle').click();
    await expect(page.locator('.card.ready')).toContainText('Welcome back');
    await expect(page.locator('.card.idle')).toHaveCount(0);

    await page.locator('.toggle').click();
    await expect(page.locator('.card.idle')).toContainText('Please log in');
    await expect(page.locator('.card.ready')).toHaveCount(0);
});
