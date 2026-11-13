import { expect, test } from '@playwright/test';

test('mx-conditional-in-row: per-row detail toggles and follows its row across reorder', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-conditional-in-row');
    const app = page.locator('mx-conditional-in-row');
    await expect(app.locator('.detail')).toHaveCount(1);
    await expect(app.locator('.row[data-id="1"] .detail')).toHaveText('da');

    await app.locator('.row[data-id="2"] .row-toggle').click();
    await expect(app.locator('.detail')).toHaveCount(2);
    await expect(app.locator('.row[data-id="2"] .detail')).toHaveText('db');

    await app.locator('.row[data-id="1"] .row-toggle').click();
    await expect(app.locator('.detail')).toHaveCount(1);

    await app.locator('#reverse').click();
    await expect(app.locator('.row').first()).toHaveAttribute('data-id', '3');
    await expect(app.locator('.detail')).toHaveCount(1);
    await expect(app.locator('.row[data-id="2"] .detail')).toHaveText('db');

    expect(errors).toEqual([]);
});
