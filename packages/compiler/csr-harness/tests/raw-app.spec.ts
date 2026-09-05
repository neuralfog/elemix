import { expect, test } from '@playwright/test';

test('raw-app: raw ticks stay silent until refresh, reactive count updates', async ({
    page,
}) => {
    await page.goto('/view/raw-app');

    const ticks = page.locator('.ticks');
    const count = page.locator('.count');
    const rlabels = page.locator('ul.rows li.row .rlabel');
    const rids = page.locator('ul.rows li.row .rid');

    await expect(ticks).toHaveText('0');
    await expect(count).toHaveText('0');
    await expect(rlabels).toHaveText(['A']);

    await page.locator('.tick').click();
    await page.locator('.tick').click();
    await page.locator('.tick').click();
    await expect(ticks).toHaveText('0');

    await page.locator('.refresh').click();
    await expect(ticks).toHaveText('3');

    await page.locator('.inc').click();
    await expect(count).toHaveText('1');

    await page.locator('.tick').click();
    await page.locator('.inc').click();
    await expect(count).toHaveText('2');
    await expect(ticks).toHaveText('3');

    await page.locator('.refresh').click();
    await expect(ticks).toHaveText('4');

    await page.locator('.add-row').click();
    await expect(rlabels).toHaveText(['A', 'B']);
    await expect(rids).toHaveText(['a', 'b']);
});
