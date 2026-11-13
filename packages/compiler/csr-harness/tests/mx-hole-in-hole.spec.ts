import { expect, test } from '@playwright/test';

test('mx-hole-in-hole: inner flips under outer, outer drop clears inner, mutate survives', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-hole-in-hole');
    const app = page.locator('mx-hole-in-hole');
    await expect(app.locator('.o-label')).toHaveText('o');
    await expect(app.locator('.inner')).toHaveText('i1');

    await app.locator('#toggle-inner').click();
    await expect(app.locator('.inner')).toHaveCount(0);
    await expect(app.locator('.outer')).toHaveCount(1);

    await app.locator('#toggle-inner').click();
    await expect(app.locator('.inner')).toHaveText('i1');

    await app.locator('#bump').click();
    await expect(app.locator('.inner')).toHaveText('i2');

    await app.locator('#toggle-outer').click();
    await expect(app.locator('.outer')).toHaveCount(0);
    await expect(app.locator('.inner')).toHaveCount(0);

    await app.locator('#toggle-outer').click();
    await expect(app.locator('.outer')).toHaveCount(1);
    await expect(app.locator('.inner')).toHaveText('i2');

    expect(errors).toEqual([]);
});
