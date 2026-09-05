import { expect, test } from '@playwright/test';

test('multi-state-app: independent state slices update on their own', async ({
    page,
}) => {
    await page.goto('/view/multi-state-app');

    const count = page.locator('.count');
    const name = page.locator('.name');
    const status = page.locator('.status');

    const buttons = page.locator('button');
    const inc = buttons.nth(0);
    const reset = buttons.nth(1);
    const toggle = buttons.nth(2);
    const rename = buttons.nth(3);

    await expect(inc).toHaveText('+1');
    await expect(reset).toHaveText('reset');
    await expect(toggle).toHaveText('toggle status');
    await expect(rename).toHaveText('rename');

    await expect(count).toHaveText('0');
    await expect(name).toHaveText('Ada');
    await expect(status).toHaveText('online');

    await inc.click();
    await inc.click();
    await inc.click();
    await expect(count).toHaveText('3');
    await expect(name).toHaveText('Ada');
    await expect(status).toHaveText('online');

    await reset.click();
    await expect(count).toHaveText('0');
    await expect(name).toHaveText('Ada');

    await inc.click();
    await expect(count).toHaveText('1');

    await toggle.click();
    await expect(status).toHaveText('offline');
    await expect(count).toHaveText('1');
    await toggle.click();
    await expect(status).toHaveText('online');

    await rename.click();
    await expect(name).toHaveText('Grace');
    await expect(count).toHaveText('1');
    await expect(status).toHaveText('online');
    await rename.click();
    await expect(name).toHaveText('Ada');
});
