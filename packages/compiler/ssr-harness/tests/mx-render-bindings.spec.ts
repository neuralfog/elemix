import { expect, test } from '@playwright/test';

test('mx-render-bindings: SSRs then repaints every hole type via render()', async ({
    page,
}) => {
    const res = await page.goto('/mx-render-bindings');
    const html = (await res?.text()) ?? '';
    expect(html).toContain('>hi<');
    expect(html).toContain('data-v="a1"');

    await page.waitForFunction(
        () => !!customElements.get('mx-render-bindings'),
    );
    const root = page.locator('mx-render-bindings');
    await expect(root.locator('.text')).toHaveText('hi');
    await expect(root.locator('.box')).toHaveClass('box red');

    await root.locator('button.mut').click();

    await expect(root.locator('.text')).toHaveText('bye');
    await expect(root.locator('.attr')).toHaveAttribute('data-v', 'a2');
    await expect(root.locator('.box')).toHaveClass('box green');
    await expect(root.locator('[data-t="obj"]')).toHaveClass('on base');
    await expect(root.locator('.style')).toHaveAttribute(
        'style',
        /color:\s*orange/,
    );
});
