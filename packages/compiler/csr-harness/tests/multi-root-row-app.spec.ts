import { expect, test } from '@playwright/test';

test('multi-root-row-app: add appends inner and tail rows', async ({
    page,
}) => {
    await page.goto('/view/multi-root-row-app');

    await expect(page.locator('.inner')).toHaveText(['a', 'b', 'c']);
    await expect(page.locator('.tail')).toHaveText(['end-g1', 'end-g2']);

    await page.locator('.add').click();
    await expect(page.locator('.inner')).toHaveText(['a', 'b', 'c', 'z']);
    await expect(page.locator('.tail')).toHaveText([
        'end-g1',
        'end-g2',
        'end-g3',
    ]);
});
