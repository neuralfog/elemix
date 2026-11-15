import { expect, test } from '@playwright/test';

test('html-directive-app: html() renders raw markup and swaps it reactively', async ({
    page,
}) => {
    await page.goto('/view/html-directive-app');

    const sink = page.locator('#sink');
    await expect(sink.locator('strong.m')).toHaveText('bold');
    await expect(sink).toContainText('raw');

    await page.locator('#swap').click();
    await expect(sink.locator('em.m')).toHaveText('italic');
    await expect(sink.locator('strong.m')).toHaveCount(0);
});
