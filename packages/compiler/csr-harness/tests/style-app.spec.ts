import { expect, test } from '@playwright/test';

test('style-app: cycles inline color, size and background', async ({
    page,
}) => {
    await page.goto('/view/style-app');

    const box = page.locator('.box');
    const colorBtn = page.locator('button').nth(0);
    const sizeBtn = page.locator('button').nth(1);
    const bgBtn = page.locator('button').nth(2);

    await expect(box).toHaveCSS('color', 'rgb(30, 41, 59)');
    await expect(box).toHaveCSS('font-size', '18px');
    await expect(box).toHaveCSS('background-color', 'rgb(224, 231, 255)');

    await colorBtn.click();
    await expect(box).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(box).toHaveCSS('font-size', '18px');
    await expect(box).toHaveCSS('background-color', 'rgb(224, 231, 255)');
    await colorBtn.click();
    await expect(box).toHaveCSS('color', 'rgb(30, 41, 59)');

    await sizeBtn.click();
    await expect(box).toHaveCSS('font-size', '22px');
    await sizeBtn.click();
    await expect(box).toHaveCSS('font-size', '26px');
    await sizeBtn.click();
    await expect(box).toHaveCSS('font-size', '30px');
    await sizeBtn.click();
    await expect(box).toHaveCSS('font-size', '14px');

    await bgBtn.click();
    await expect(box).toHaveCSS('background-color', 'rgb(99, 102, 241)');
    await bgBtn.click();
    await expect(box).toHaveCSS('background-color', 'rgb(224, 231, 255)');
});
