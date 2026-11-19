import { expect, test } from '@playwright/test';

test('mx-render-bindings: every hole type repaints via render()', async ({
    page,
}) => {
    await page.goto('/view/mx-render-bindings');
    await expect(page.locator('.text')).toHaveText('hi');
    await expect(page.locator('.attr')).toHaveAttribute('data-v', 'a1');
    await expect(page.locator('.box')).toHaveClass('box red');
    await expect(page.locator('[data-t="obj"]')).toHaveClass('base');

    await page.locator('button.mut').click();

    await expect(page.locator('.text')).toHaveText('bye');
    await expect(page.locator('.attr')).toHaveAttribute('data-v', 'a2');
    await expect(page.locator('.box')).toHaveClass('box green');
    await expect(page.locator('[data-t="obj"]')).toHaveClass('on base');
    await expect(page.locator('.style')).toHaveAttribute(
        'style',
        /color:\s*orange/,
    );
    await expect(page.locator('.style')).toHaveAttribute(
        'style',
        /width:\s*20px/,
    );
});
