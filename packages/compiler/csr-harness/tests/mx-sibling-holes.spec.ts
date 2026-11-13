import { expect, test } from '@playwright/test';

test('mx-sibling-holes: adjacent holes keep position as each goes null', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-sibling-holes');
    const app = page.locator('mx-sibling-holes');
    await expect(app.locator('.holes')).toHaveText('[ A B C ]');

    await app.locator('#toggle-b').click();
    await expect(app.locator('.b')).toHaveCount(0);
    await expect(app.locator('.holes')).toHaveText('[ A C ]');

    await app.locator('#toggle-a').click();
    await expect(app.locator('.holes')).toHaveText('[ C ]');

    await app.locator('#toggle-c').click();
    await expect(app.locator('.hole')).toHaveCount(0);
    await expect(app.locator('.holes')).toHaveText('[ ]');
    await expect(app.locator('.start')).toHaveText('[');
    await expect(app.locator('.end')).toHaveText(']');

    await app.locator('#toggle-a').click();
    await app.locator('#toggle-b').click();
    await app.locator('#toggle-c').click();
    await expect(app.locator('.holes')).toHaveText('[ A B C ]');

    expect(errors).toEqual([]);
});
