import { expect, test } from '@playwright/test';

test('mx-render-nested: list-in-list repaints inner content via render()', async ({
    page,
}) => {
    await page.goto('/view/mx-render-nested');
    await expect(page.locator('.group[data-id="1"] .item')).toHaveCount(2);

    await page.locator('button.edit-inner').click();
    await expect(
        page.locator('.group[data-id="1"] .item[data-id="11"]'),
    ).toHaveText('a!');

    await page.locator('button.add-inner').click();
    await expect(page.locator('.group[data-id="1"] .item')).toHaveCount(3);

    await page.locator('button.edit-outer').click();
    await expect(page.locator('.group[data-id="1"] .gname')).toHaveText('g1!');

    await expect(page.locator('.group[data-id="2"] .item')).toHaveCount(1);
});
