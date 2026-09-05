import { expect, test } from '@playwright/test';

test('deep-state-app: nested object/array/matrix mutations react', async ({
    page,
}) => {
    await page.goto('/view/deep-state-app');

    const gid = page.locator('ul.group-list li.group .gid');
    const tcount = page.locator('ul.group-list li.group .tcount');

    await expect(page.locator('.city')).toHaveText('London');
    await expect(page.locator('.lat')).toHaveText('51');
    await expect(page.locator('.lng')).toHaveText('0');
    await expect(page.locator('.tags')).toHaveText('a,b');
    await expect(page.locator('.grid')).toHaveText('1|2 3|4');
    await expect(page.locator('.cell')).toHaveText('2');
    await expect(page.locator('.groups-str')).toHaveText('g0(write)');
    await expect(gid).toHaveText(['g0']);
    await expect(tcount).toHaveText(['1']);

    await page.locator('.rename-city').click();
    await expect(page.locator('.city')).toHaveText('Paris');

    await page.locator('.move-lat').click();
    await expect(page.locator('.lat')).toHaveText('52');

    await page.locator('.replace-geo').click();
    await expect(page.locator('.lat')).toHaveText('99');
    await expect(page.locator('.lng')).toHaveText('99');

    await page.locator('.add-tag').click();
    await expect(page.locator('.tags')).toHaveText('a,b,c');

    await page.locator('.set-cell').click();
    await expect(page.locator('.cell')).toHaveText('9');
    await expect(page.locator('.grid')).toHaveText('1|9 3|4');

    await page.locator('.push-col').click();
    await expect(page.locator('.grid')).toHaveText('1|9|5 3|4');
    await expect(page.locator('.cell')).toHaveText('9');

    await page.locator('.add-row').click();
    await expect(page.locator('.grid')).toHaveText('1|9|5 3|4 7|8');

    await page.locator('.toggle-task').click();
    await expect(page.locator('.groups-str')).toHaveText('g0(write!)');

    await page.locator('.add-task').click();
    await expect(page.locator('.groups-str')).toHaveText('g0(write!,review)');
    await expect(tcount).toHaveText(['2']);

    await page.locator('.add-group').click();
    await expect(page.locator('.groups-str')).toHaveText(
        'g0(write!,review) g1()',
    );
    await expect(gid).toHaveText(['g0', 'g1']);
    await expect(tcount).toHaveText(['2', '0']);
});
