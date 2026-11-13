import { expect, test } from '@playwright/test';

test('mx-deep-nest: a transition at every depth (conditional>list>component>conditional>hole)', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-deep-nest');
    const app = page.locator('mx-deep-nest');
    await expect(app.locator('.row')).toHaveCount(2);
    await expect(app.locator('.x')).toHaveCount(1);
    await expect(app.locator('.row[data-id="1"] .x')).toHaveText('1');

    await app.locator('.row[data-id="1"] .child-bump').click();
    await expect(app.locator('.row[data-id="1"] .child-count')).toHaveText('1');

    await app.locator('.row[data-id="2"] .flag').click();
    await expect(app.locator('.x')).toHaveCount(2);

    await app.locator('.row[data-id="1"] .x-bump').click();
    await expect(app.locator('.row[data-id="1"] .x')).toHaveText('2');

    await app.locator('#reverse').click();
    await expect(app.locator('.row').first()).toHaveAttribute('data-id', '2');
    await expect(app.locator('.row[data-id="1"] .child-count')).toHaveText('1');
    await expect(app.locator('.row[data-id="1"] .x')).toHaveText('2');

    await app.locator('#toggle-show').click();
    await expect(app.locator('.row')).toHaveCount(0);

    await app.locator('#toggle-show').click();
    await expect(app.locator('.row')).toHaveCount(2);
    await expect(app.locator('.row[data-id="1"] .x')).toHaveText('2');
    await expect(app.locator('.row[data-id="1"] .child-count')).toHaveText('0');

    expect(errors).toEqual([]);
});
