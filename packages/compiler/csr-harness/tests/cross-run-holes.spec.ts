import { expect, test } from '@playwright/test';

test('cross-run-holes-app: two text holes split by a static element are reactive (CSR)', async ({
    page,
}) => {
    await page.goto('/view/cross-run-holes-app');
    const pair = page.locator('cross-run-holes-app .pair');
    await expect(pair).toHaveText('A|B');

    await page.locator('cross-run-holes-app button').click();
    await expect(pair).toHaveText('X|Y');
});
