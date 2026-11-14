import { expect, test } from '@playwright/test';

test.describe('root-array (SSR + hydrate)', () => {
    test('root reactive array length stays tracked after hydration', async ({
        page,
    }) => {
        await page.goto('/root-array-app');
        await page.waitForFunction(
            () => !!customElements.get('root-array-app'),
        );
        const len = page.locator('root-array-app .len');
        await expect(len).toHaveText('3');

        await page.locator('root-array-app button').click();
        await expect(len).toHaveText('4');
    });
});
