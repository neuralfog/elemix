import { expect, test } from '@playwright/test';

test('primitive-state-app: count, toggle, reset, rename', async ({ page }) => {
    await page.goto('/view/primitive-state-app');

    const count = page.locator('.count');
    const active = page.locator('.active');
    const label = page.locator('.label');
    const inc = page.locator('button').nth(0);
    const reset = page.locator('button').nth(1);
    const toggle = page.locator('button').nth(2);
    const rename = page.locator('button').nth(3);

    await expect(count).toHaveText('0');
    await expect(active).toHaveText('on');
    await expect(label).toHaveText('idle');

    await inc.click();
    await inc.click();
    await inc.click();
    await expect(count).toHaveText('3');
    await expect(active).toHaveText('on');
    await expect(label).toHaveText('idle');

    await reset.click();
    await expect(count).toHaveText('0');
    await reset.click();
    await expect(count).toHaveText('0');

    await toggle.click();
    await expect(active).toHaveText('off');
    await expect(count).toHaveText('0');
    await toggle.click();
    await expect(active).toHaveText('on');

    await rename.click();
    await expect(label).toHaveText('busy');
    await expect(active).toHaveText('on');
    await rename.click();
    await expect(label).toHaveText('idle');

    await inc.click();
    await expect(count).toHaveText('1');
});
