import { expect, test } from '@playwright/test';

test('empty-trailing-hole-app: empty trailing interpolation is reactive (CSR)', async ({
    page,
}) => {
    await page.goto('/view/empty-trailing-hole-app');
    const greet = page.locator('empty-trailing-hole-app .greet');
    await expect(greet).toHaveText('Hello');

    await page.locator('empty-trailing-hole-app button').click();
    await expect(greet).toHaveText('Hello World');
});
