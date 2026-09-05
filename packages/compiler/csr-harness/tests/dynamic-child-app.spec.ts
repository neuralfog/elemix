import { expect, test } from '@playwright/test';

test('dynamic-child-app: keyed rows render and badge swaps', async ({
    page,
}) => {
    await page.goto('/view/dynamic-child-app');

    await expect(page.locator('.row[data-id="a"] .icon-a')).toHaveCount(1);
    await expect(page.locator('.row[data-id="b"] .icon-b')).toHaveCount(1);

    await expect(page.locator('.swap')).toHaveText('plain');
    await expect(page.locator('.swap .badge')).toHaveCount(0);

    await page.locator('.toggle').click();
    await expect(page.locator('.swap .badge')).toHaveText('NEW');

    await page.locator('.toggle').click();
    await expect(page.locator('.swap .badge')).toHaveCount(0);
    await expect(page.locator('.swap')).toHaveText('plain');
});
