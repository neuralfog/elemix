import { expect, test } from '@playwright/test';

test('interp-app: interpolation across swap, middle and counter', async ({
    page,
}) => {
    await page.goto('/view/interp-app');

    const full = page.locator('.full');
    const dash = page.locator('.dash');
    const middle = page.locator('.middle');
    const num = page.locator('.num');

    const buttons = page.locator('button');
    const swapBtn = buttons.nth(0);
    const setMiddleBtn = buttons.nth(1);
    const incBtn = buttons.nth(2);

    await expect(full).toHaveText('full: AdaLovelace');
    await expect(dash).toHaveText('dash: Ada-Lovelace');
    await expect(middle).toHaveText('middle: []');
    await expect(num).toHaveText('num: 0');

    await incBtn.click();
    await expect(num).toHaveText('num: 1');
    await incBtn.click();
    await expect(num).toHaveText('num: 2');

    await setMiddleBtn.click();
    await expect(middle).toHaveText('middle: [M]');
    await setMiddleBtn.click();
    await expect(middle).toHaveText('middle: []');

    await swapBtn.click();
    await expect(full).toHaveText('full: LovelaceAda');
    await expect(dash).toHaveText('dash: Lovelace-Ada');
    await swapBtn.click();
    await expect(full).toHaveText('full: AdaLovelace');
    await expect(dash).toHaveText('dash: Ada-Lovelace');
});
