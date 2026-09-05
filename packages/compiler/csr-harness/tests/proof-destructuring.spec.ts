import { expect, test } from '@playwright/test';

test('proof-destructuring: inc and dec adjust count', async ({ page }) => {
    await page.goto('/view/proof-destructuring');

    const count = page.locator('.count');
    const inc = page.locator('.inc');
    const dec = page.locator('.dec');

    await expect(count).toHaveText('0');
    await inc.click();
    await inc.click();
    await expect(count).toHaveText('2');
    await dec.click();
    await expect(count).toHaveText('1');
});
