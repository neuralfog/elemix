import { expect, test } from '@playwright/test';

test('model-app: two-way model binds name and clamps volume', async ({
    page,
}) => {
    await page.goto('/view/model-app');

    const inputs = page.locator('input');
    const nameInput = inputs.nth(0);
    const volumeInput = inputs.nth(1);
    const outs = page.locator('.out');
    const nameOut = outs.nth(0);
    const volumeOut = outs.nth(1);

    await expect(nameInput).toHaveValue('Ada');
    await expect(nameOut).toHaveText('Hello, Ada');

    await nameInput.fill('Ada Lovelace');
    await expect(nameInput).toHaveValue('Ada Lovelace');
    await expect(nameOut).toHaveText('Hello, Ada Lovelace');

    await expect(volumeInput).toHaveValue('50');
    await expect(volumeOut).toHaveText('Volume: 50');

    await volumeInput.fill('509');
    await expect(volumeInput).toHaveValue('100');
    await expect(volumeOut).toHaveText('Volume: 100');
});
