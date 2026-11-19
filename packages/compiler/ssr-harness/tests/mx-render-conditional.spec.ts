import { expect, test } from '@playwright/test';

test('mx-render-conditional: SSRs when/choose then repaints branches via render()', async ({
    page,
}) => {
    const res = await page.goto('/mx-render-conditional');
    const html = (await res?.text()) ?? '';
    expect(html).toContain('>off<');
    expect(html).toContain('>zero<');

    await page.waitForFunction(
        () => !!customElements.get('mx-render-conditional'),
    );
    const root = page.locator('mx-render-conditional');
    await expect(root.locator('.when .hidden')).toHaveText('off');

    await root.locator('button.toggle').click();
    await expect(root.locator('.when .shown')).toHaveText('x');

    await root.locator('button.edit-inner').click();
    await expect(root.locator('.when .shown')).toHaveText('x!');

    await expect(root.locator('.choose .zero')).toHaveText('zero');
    await root.locator('button.grade').click();
    await expect(root.locator('.choose .one')).toHaveText('one');
    await root.locator('button.grade').click();
    await expect(root.locator('.choose .two')).toHaveText('two');
});
