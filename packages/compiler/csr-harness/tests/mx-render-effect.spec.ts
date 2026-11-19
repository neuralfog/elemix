import { expect, test } from '@playwright/test';

test('mx-render-effect: render() repaints view but does not fire #effect', async ({
    page,
}) => {
    await page.goto('/view/mx-render-effect');
    await expect(page.locator('.runs')).toHaveText('1');
    await expect(page.locator('.label')).toHaveText('a');

    await page.locator('button.paint').click();
    await expect(page.locator('.label')).toHaveText('a!');
    await expect(page.locator('.runs')).toHaveText('1');

    await page.locator('button.bump').click();
    await expect(page.locator('.runs')).toHaveText('2');
});
