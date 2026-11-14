import { expect, test } from '@playwright/test';

test.describe('delete-prop (SSR + hydrate)', () => {
    test('deleting a tracked property re-renders after hydration', async ({
        page,
    }) => {
        const response = await page.goto('/delete-prop-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('present');

        await page.waitForFunction(
            () => !!customElements.get('delete-prop-app'),
        );
        const val = page.locator('delete-prop-app .val');
        await expect(val).toHaveText('present');

        await page.locator('delete-prop-app button').click();
        await expect(val).toHaveText('');
    });
});
