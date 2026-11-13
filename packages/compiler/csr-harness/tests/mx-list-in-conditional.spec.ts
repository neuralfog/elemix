import { expect, test } from '@playwright/test';

test('mx-list-in-conditional: toggle the whole list off/on and mutate while shown', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-list-in-conditional');
    const app = page.locator('mx-list-in-conditional');
    await expect(app.locator('.list')).toHaveCount(1);
    await expect(app.locator('.list')).toHaveText('ab');

    await app.locator('#toggle').click();
    await expect(app.locator('.list')).toHaveCount(0);

    await app.locator('#toggle').click();
    await expect(app.locator('.list')).toHaveText('ab');

    await app.locator('#add').click();
    await expect(app.locator('.list')).toHaveText('abn3');

    await app.locator('#toggle').click();
    await expect(app.locator('.list')).toHaveCount(0);
    await app.locator('#toggle').click();
    await expect(app.locator('.list')).toHaveText('abn3');

    expect(errors).toEqual([]);
});
