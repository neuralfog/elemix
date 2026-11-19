import { expect, test } from '@playwright/test';

test('mx-render-conditional: when/choose branches repaint via render()', async ({
    page,
}) => {
    await page.goto('/view/mx-render-conditional');
    await expect(page.locator('.when .hidden')).toHaveText('off');

    await page.locator('button.toggle').click();
    await expect(page.locator('.when .shown')).toHaveText('x');

    await page.locator('button.edit-inner').click();
    await expect(page.locator('.when .shown')).toHaveText('x!');

    await expect(page.locator('.choose .zero')).toHaveText('zero');
    await page.locator('button.grade').click();
    await expect(page.locator('.choose .one')).toHaveText('one');
    await page.locator('button.grade').click();
    await expect(page.locator('.choose .two')).toHaveText('two');
});
