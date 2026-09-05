import { expect, test } from '@playwright/test';

test('render-app: silent mutations only paint after render()', async ({
    page,
}) => {
    await page.goto('/view/render-app');

    const value = page.locator('.value');
    const silent = page.locator('button').nth(0);
    const withRender = page.locator('button').nth(1);

    await expect(silent).toHaveText('Increment (silent)');
    await expect(silent).toHaveClass(/\bghost\b/);
    await expect(withRender).toHaveText('Increment + render()');

    await expect(value).toHaveText('0');

    await silent.click();
    await expect(value).toHaveText('0');
    await silent.click();
    await silent.click();
    await expect(value).toHaveText('0');

    await withRender.click();
    await expect(value).toHaveText('4');

    await silent.click();
    await silent.click();
    await expect(value).toHaveText('4');

    await withRender.click();
    await expect(value).toHaveText('7');
});
