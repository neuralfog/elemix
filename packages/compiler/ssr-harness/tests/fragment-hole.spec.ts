import { expect, test } from '@playwright/test';

test.describe('fragment-hole (SSR + hydrate)', () => {
    test('hiding a fragment hole removes inner-list-added nodes after hydration', async ({
        page,
    }) => {
        await page.goto('/fragment-hole-app');
        await page.waitForFunction(
            () => !!customElements.get('fragment-hole-app'),
        );
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
});
