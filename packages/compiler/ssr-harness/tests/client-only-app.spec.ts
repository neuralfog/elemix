import { expect, test } from '@playwright/test';

test.describe('ClientOnlyApp', () => {
    test('#client renders NOTHING server-side (bare host, no before-mount); mounts fresh client-side', async ({
        page,
    }) => {
        const response = await page.goto('/client-only-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<client-only-app></client-only-app>');
        expect(served).not.toContain('count is');
        expect(served).not.toContain('shadowrootmode');

        await page.waitForFunction(
            () => !!customElements.get('client-only-app'),
        );

        const button = page.locator('client-only-app button');
        await expect(button).toHaveText('count is 7');

        await button.click();
        await expect(button).toHaveText('count is 8');
        await button.click();
        await expect(button).toHaveText('count is 9');
    });
});
