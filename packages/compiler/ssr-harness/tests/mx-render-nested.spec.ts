import { expect, test } from '@playwright/test';

test('mx-render-nested: SSRs list-in-list then repaints inner content via render()', async ({
    page,
}) => {
    const res = await page.goto('/mx-render-nested');
    const html = (await res?.text()) ?? '';
    expect(html).toContain('>g1<');
    expect(html).toContain('>a<');

    await page.waitForFunction(() => !!customElements.get('mx-render-nested'));
    const root = page.locator('mx-render-nested');
    await expect(root.locator('.group[data-id="1"] .item')).toHaveCount(2);

    await root.locator('button.edit-inner').click();
    await expect(
        root.locator('.group[data-id="1"] .item[data-id="11"]'),
    ).toHaveText('a!');

    await root.locator('button.add-inner').click();
    await expect(root.locator('.group[data-id="1"] .item')).toHaveCount(3);

    await root.locator('button.edit-outer').click();
    await expect(root.locator('.group[data-id="1"] .gname')).toHaveText('g1!');

    await expect(root.locator('.group[data-id="2"] .item')).toHaveCount(1);
});
