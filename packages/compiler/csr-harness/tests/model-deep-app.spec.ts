import { expect, test } from '@playwright/test';

test('model-deep-app: deep model updates readout', async ({ page }) => {
    await page.goto('/view/model-deep-app');

    const input = page.locator('input').first();
    const out = page.locator('.out').first();

    await expect(input).toHaveValue('Ada');
    await expect(out).toHaveText('Hello, Ada');

    await input.fill('Ada Lovelace');
    await expect(input).toHaveValue('Ada Lovelace');
    await expect(out).toHaveText('Hello, Ada Lovelace');
});
