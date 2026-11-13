import { expect, test } from '@playwright/test';

test('mx-text-hole: primitive run survives null, empty, number and length changes', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-text-hole');
    const app = page.locator('mx-text-hole');
    await expect(app.locator('.run')).toHaveText('[ A B ]');

    await app.locator('#a-null').click();
    await expect(app.locator('.run')).toHaveText('[ B ]');

    await app.locator('#a-text').click();
    await expect(app.locator('.run')).toHaveText('[ A2 B ]');

    await app.locator('#a-empty').click();
    await expect(app.locator('.run')).toHaveText('[ B ]');

    await app.locator('#a-num').click();
    await expect(app.locator('.run')).toHaveText('[ 0 B ]');

    await app.locator('#b-long').click();
    await expect(app.locator('.run')).toHaveText('[ 0 BBBBB ]');

    await app.locator('#b-null').click();
    await expect(app.locator('.run')).toHaveText('[ 0 ]');

    expect(errors).toEqual([]);
});
