import { expect, test } from '@playwright/test';

test('null-guard-app: data-guarded hole survives data going null', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/null-guard-app');
    const app = page.locator('null-guard-app');
    await expect(app.locator('.val')).toHaveText('first');

    await app.locator('#toggle').click();
    await expect(app.locator('.empty')).toHaveText('empty');
    await expect(app.locator('.val')).toHaveCount(0);

    await app.locator('#toggle').click();
    await expect(app.locator('.val')).toHaveText('again');

    expect(errors).toEqual([]);
});
