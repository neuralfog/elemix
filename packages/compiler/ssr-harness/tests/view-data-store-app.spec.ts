import { expect, test } from '@playwright/test';

test.describe('ViewDataStoreApp', () => {
    test('a module #state store seeded from viewData renders the server value and stays reactive after hydration', async ({
        page,
    }) => {
        const response = await page.goto('/view-data-store-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="count">5</span>');
        expect(served).toContain('id="__elemix_vd"');

        await page.waitForFunction(() =>
            customElements.get('view-data-store-app'),
        );

        const count = page.locator('view-data-store-app .count');
        await expect(count).toHaveText('5');

        await page.locator('view-data-store-app .inc').click();
        await expect(count).toHaveText('6');
        await page.locator('view-data-store-app .inc').click();
        await expect(count).toHaveText('7');
    });
});
