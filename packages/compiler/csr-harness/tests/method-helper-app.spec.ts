import { expect, test } from '@playwright/test';

test('method-helper-app: helper-driven chips, count and toggle', async ({
    page,
}) => {
    await page.goto('/view/method-helper-app');

    await expect(page.locator('.row .chip')).toHaveText(['a', 'b']);
    await expect(page.locator('.open .chip')).toHaveText('open');
    await expect(page.locator('.count')).toHaveText('0');

    await page.locator('.inc').click();
    await expect(page.locator('.count')).toHaveText('1');

    await page.locator('.toggle').click();
    await expect(page.locator('.closed')).toHaveText('closed');
    await expect(page.locator('.open')).toHaveCount(0);
});
