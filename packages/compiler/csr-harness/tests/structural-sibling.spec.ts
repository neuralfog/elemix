import { expect, test } from '@playwright/test';

test('structural-sibling-app: conditional sibling of a text hole toggles (CSR)', async ({
    page,
}) => {
    await page.goto('/view/structural-sibling-app');
    const host = page.locator('structural-sibling-app');
    await expect(host.locator('b.flag')).toHaveCount(1);
    await expect(host.locator('b.flag')).toHaveText('x');

    await host.locator('button').click();
    await expect(host.locator('b.flag')).toHaveCount(0);
    await host.locator('button').click();
    await expect(host.locator('b.flag')).toHaveCount(1);
});
