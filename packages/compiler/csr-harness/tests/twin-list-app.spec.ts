import { expect, test } from '@playwright/test';

test('twin-list-app: appends to the two independent lists', async ({
    page,
}) => {
    await page.goto('/view/twin-list-app');

    const left = page.locator('.left');
    const right = page.locator('.right');

    await expect(left).toHaveText(['a', 'b', 'c']);
    await expect(right).toHaveText(['x', 'y']);

    await page.locator('.add-left').click();
    await expect(left).toHaveText(['a', 'b', 'c', 'l3']);
    await expect(right).toHaveText(['x', 'y']);

    await page.locator('.add-right').click();
    await expect(left).toHaveText(['a', 'b', 'c', 'l3']);
    await expect(right).toHaveText(['x', 'y', 'r2']);
});
