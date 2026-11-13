import { expect, test } from '@playwright/test';

test('mx-list-transitions: empty/one/many/reorder/swap/remove/rebuild', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-list-transitions');
    const app = page.locator('mx-list-transitions');
    const list = app.locator('.list');
    await expect(app.locator('.row')).toHaveCount(3);
    await expect(list).toHaveText('abc');

    await app.locator('#reverse').click();
    await expect(list).toHaveText('cba');

    await app.locator('#swap').click();
    await expect(list).toHaveText('abc');

    await app.locator('#remove-middle').click();
    await expect(list).toHaveText('ac');

    await app.locator('#add').click();
    await expect(list).toHaveText('acn4');

    await app.locator('#clear').click();
    await expect(app.locator('.row')).toHaveCount(0);

    await app.locator('#add').click();
    await expect(list).toHaveText('n5');

    await app.locator('#rebuild').click();
    await expect(list).toHaveText('abc');

    expect(errors).toEqual([]);
});
