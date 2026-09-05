import { expect, test } from '@playwright/test';

test('store-app: shared store syncs parent readout and child controls', async ({
    page,
}) => {
    await page.goto('/view/store-app');

    const readout = page.locator('.readout strong');
    const controls = page.locator('store-controls');
    const value = controls.locator('.value');
    const dec = controls.locator('button').nth(0);
    const inc = controls.locator('button').nth(1);

    await expect(dec).toHaveText('−');
    await expect(inc).toHaveText('+');
    await expect(controls.locator('.label')).toHaveText('Child controls');

    await expect(readout).toHaveText('0');
    await expect(value).toHaveText('0');

    await inc.click();
    await expect(value).toHaveText('1');
    await expect(readout).toHaveText('1');

    await inc.click();
    await inc.click();
    await expect(value).toHaveText('3');
    await expect(readout).toHaveText('3');

    await dec.click();
    await expect(value).toHaveText('2');
    await expect(readout).toHaveText('2');

    await dec.click();
    await dec.click();
    await dec.click();
    await expect(value).toHaveText('-1');
    await expect(readout).toHaveText('-1');
});
