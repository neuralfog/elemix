import { expect, test } from '@playwright/test';

test('custom-event-app: catches a dispatched custom event', async ({
    page,
}) => {
    await page.goto('/view/custom-event-app');
    await expect(page.locator('.caught')).toHaveText('0');
    await page.locator('.fire').click();
    await expect(page.locator('.caught')).toHaveText('1');
});
