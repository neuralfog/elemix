import { expect, test } from '@playwright/test';

test.describe('fragment-row (SSR + hydrate)', () => {
    test('inner-edge mutation then outer reorder keeps rows intact after hydration', async ({
        page,
    }) => {
        await page.goto('/fragment-row-app');
        await page.waitForFunction(
            () => !!customElements.get('fragment-row-app'),
        );
        const texts = () =>
            page
                .locator('fragment-row-app .inner, fragment-row-app .tail')
                .allTextContents();

        await expect
            .poll(texts)
            .toEqual(['a', 'b', 'end-g1', 'c', 'd', 'end-g2']);

        await page.locator('fragment-row-app .prepend').click();
        await expect
            .poll(texts)
            .toEqual(['z', 'a', 'b', 'end-g1', 'c', 'd', 'end-g2']);

        await page.locator('fragment-row-app .reverse').click({ force: true });
        await expect
            .poll(texts)
            .toEqual(['c', 'd', 'end-g2', 'z', 'a', 'b', 'end-g1']);
    });
});
