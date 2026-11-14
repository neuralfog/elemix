import { expect, test } from '@playwright/test';

test('fragment-hole-app: hiding a fragment hole removes nodes an inner list added while shown (CSR)', async ({
    page,
}) => {
    await page.goto('/view/fragment-hole-app');
    const box = page.locator('fragment-hole-app .box');
    const parts = () => box.locator('.it, .tail').allTextContents();

    await expect.poll(parts).toEqual(['a', 'b', 'tail']);

    await page.locator('fragment-hole-app .add').click();
    await expect.poll(parts).toEqual(['a', 'b', 'c', 'tail']);

    await page.locator('fragment-hole-app .toggle').click();
    await expect.poll(parts).toEqual([]);

    await page.locator('fragment-hole-app .toggle').click();
    await expect.poll(parts).toEqual(['a', 'b', 'c', 'tail']);
});
