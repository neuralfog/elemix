import { expect, test } from '@playwright/test';

test('mx-component-prop: prop updates reach the child; swapping the instance remounts fresh', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-component-prop');
    const app = page.locator('mx-component-prop');
    await expect(app.locator('.slot-a')).toHaveCount(1);
    await expect(app.locator('.child-label')).toHaveText('p1');
    await expect(app.locator('.child-count')).toHaveText('0');

    await app.locator('#rename').click();
    await expect(app.locator('.child-label')).toHaveText('p2');

    await app.locator('.child-bump').click();
    await expect(app.locator('.child-count')).toHaveText('1');

    await app.locator('#swap').click();
    await expect(app.locator('.slot-b')).toHaveCount(1);
    await expect(app.locator('.slot-a')).toHaveCount(0);
    await expect(app.locator('.child-label')).toHaveText('b-p2');
    await expect(app.locator('.child-count')).toHaveText('0');

    await app.locator('#swap').click();
    await expect(app.locator('.slot-a')).toHaveCount(1);
    await expect(app.locator('.child-label')).toHaveText('p2');
    await expect(app.locator('.child-count')).toHaveText('0');

    expect(errors).toEqual([]);
});
