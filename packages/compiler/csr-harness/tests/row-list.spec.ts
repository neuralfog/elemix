import { expect, test } from '@playwright/test';

test('row-list: renders seeded rows and appends a new one', async ({
    page,
}) => {
    await page.goto('/view/row-list');

    const rows = page.locator('.row');

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveText('alpha');
    await expect(rows.nth(0)).toHaveAttribute('data-id', '1');
    await expect(rows.nth(1)).toHaveText('beta');
    await expect(rows.nth(1)).toHaveAttribute('data-id', '2');

    await page.locator('.add').click();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2)).toHaveText('new');
    await expect(rows.nth(2)).toHaveAttribute('data-id', '3');
});
