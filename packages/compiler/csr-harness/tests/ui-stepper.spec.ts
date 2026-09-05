import { expect, test } from '@playwright/test';

test('ui-stepper: adopts styles and steps the count', async ({ page }) => {
    await page.goto('/view/ui-stepper');

    const sheets = await page
        .locator('ui-stepper')
        .evaluate((el) => el.shadowRoot?.adoptedStyleSheets.length ?? 0);
    expect(sheets).toBeGreaterThan(0);

    const count = page.locator('.count');
    const dec = page.locator('button').nth(0);
    const inc = page.locator('button').nth(1);

    await expect(count).toHaveText('0');
    await inc.click();
    await expect(count).toHaveText('1');
    await inc.click();
    await expect(count).toHaveText('2');
    await dec.click();
    await expect(count).toHaveText('1');
});
