import { expect, test } from '@playwright/test';

test('prop-safe-app: a scalar-only (propSafe) child receives and reactively updates its prop (CSR)', async ({
    page,
}) => {
    await page.goto('/view/prop-safe-app');
    const lbl = page.locator('prop-safe-app prop-safe-child .lbl');
    await expect(lbl).toHaveText('hello');

    await page.locator('prop-safe-app button').click();
    await expect(lbl).toHaveText('world');
});
