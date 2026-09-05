import { expect, test } from '@playwright/test';

test('no-shadow-app: renders into the light DOM and increments', async ({
    page,
}) => {
    await page.goto('/view/no-shadow-app');

    const app = page.locator('no-shadow-app');
    await expect(app).toBeVisible();

    const hasShadow = await app.evaluate((el) => el.shadowRoot !== null);
    expect(hasShadow).toBe(false);

    const count = app.locator('.count');
    await expect(count).toHaveText('0');

    await app.locator('.inc').click();
    await expect(count).toHaveText('1');
});
