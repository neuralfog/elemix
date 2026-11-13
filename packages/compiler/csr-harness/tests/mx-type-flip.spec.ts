import { expect, test } from '@playwright/test';

test('mx-type-flip: a mixed string/markup run flips type each way and stays real markup', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-type-flip');
    const app = page.locator('mx-type-flip');
    await expect(app.locator('.mix')).toHaveText('[ tL mR ]');
    await expect(app.locator('.bR')).toHaveCount(1);
    await expect(app.locator('.bL')).toHaveCount(0);

    await app.locator('#l-markup').click();
    await expect(app.locator('.mix')).toHaveText('[ mL mR ]');
    await expect(app.locator('.bL')).toHaveCount(1);
    await expect(app.locator('.bR')).toHaveCount(1);

    await app.locator('#r-text').click();
    await expect(app.locator('.mix')).toHaveText('[ mL tR ]');
    await expect(app.locator('.bR')).toHaveCount(0);

    await app.locator('#l-null').click();
    await expect(app.locator('.mix')).toHaveText('[ tR ]');
    await expect(app.locator('.bL')).toHaveCount(0);

    await app.locator('#r-markup').click();
    await expect(app.locator('.mix')).toHaveText('[ mR ]');
    await expect(app.locator('.bR')).toHaveCount(1);

    await app.locator('#l-text').click();
    await expect(app.locator('.mix')).toHaveText('[ tL mR ]');

    await app.locator('#r-null').click();
    await expect(app.locator('.mix')).toHaveText('[ tL ]');
    await expect(app.locator('.bR')).toHaveCount(0);

    await app.locator('#l-markup').click();
    await app.locator('#r-markup').click();
    await expect(app.locator('.mix')).toHaveText('[ mL mR ]');
    await expect(app.locator('.bL')).toHaveCount(1);
    await expect(app.locator('.bR')).toHaveCount(1);

    expect(errors).toEqual([]);
});
