import { expect, test } from '@playwright/test';

test('root-array-app: reading length of a root reactive array is tracked', async ({
    page,
}) => {
    await page.goto('/view/root-array-app');
    const len = page.locator('root-array-app .len');
    await expect(len).toHaveText('3');

    await page.locator('root-array-app button').click();
    await expect(len).toHaveText('4');
});
