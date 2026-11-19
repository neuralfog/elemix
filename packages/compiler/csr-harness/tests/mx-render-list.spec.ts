import { expect, test } from '@playwright/test';

test('mx-render-list: plain-data keyed list repaints via manual render()', async ({
    page,
}) => {
    await page.goto('/view/mx-render-list');
    const items = page.locator('.rows li');
    await expect(items).toHaveCount(3);

    await page.locator('button.edit').click();
    await expect(page.locator('.rows li[data-id="2"]')).toHaveText('two!');

    await page.locator('button.toggle').click();
    await expect(page.locator('.rows li[data-id="2"]')).toHaveClass('on');
    await page.locator('button.toggle').click();
    await expect(page.locator('.rows li[data-id="2"]')).toHaveClass('off');

    await page.locator('button.add').click();
    await expect(items).toHaveCount(4);
    await page.locator('button.drop').click();
    await expect(page.locator('.rows li[data-id="2"]')).toHaveCount(0);
    await expect(items).toHaveCount(3);
    await page.locator('button.swap').click();
    await expect(items).toHaveCount(3);
    await page.locator('button.wipe').click();
    await expect(items).toHaveCount(0);
});
