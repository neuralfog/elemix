import { expect, test } from '@playwright/test';

test('mx-render-list: SSRs then repaints via manual render() after hydration', async ({
    page,
}) => {
    const res = await page.goto('/mx-render-list');
    const html = (await res?.text()) ?? '';
    expect(html).toContain('>one<');
    expect(html).toContain('>two<');

    await page.waitForFunction(() => !!customElements.get('mx-render-list'));
    const items = page.locator('mx-render-list .rows li');
    await expect(items).toHaveCount(3);

    await page.locator('mx-render-list button.edit').click();
    await expect(
        page.locator('mx-render-list .rows li[data-id="2"]'),
    ).toHaveText('two!');

    await page.locator('mx-render-list button.toggle').click();
    await expect(
        page.locator('mx-render-list .rows li[data-id="2"]'),
    ).toHaveClass('on');

    await page.locator('mx-render-list button.add').click();
    await expect(items).toHaveCount(4);
    await page.locator('mx-render-list button.drop').click();
    await expect(
        page.locator('mx-render-list .rows li[data-id="2"]'),
    ).toHaveCount(0);
    await page.locator('mx-render-list button.wipe').click();
    await expect(items).toHaveCount(0);
});
