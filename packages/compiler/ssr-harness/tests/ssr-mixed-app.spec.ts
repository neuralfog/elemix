import { expect, test } from '@playwright/test';

test.describe('SsrMixedApp', () => {
    test('mixed tree: SSR outer hydrates, #client middle + its SSR leaf mount fresh; all reactive independently', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-mixed-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<span class="on">0</span>');
        expect(served).toContain('<ssr-mixed-client></ssr-mixed-client>');
        expect(served).not.toContain('class="mid"');
        expect(served).not.toContain('class="leaf"');

        await page.waitForFunction(
            () =>
                !!customElements.get('ssr-mixed-app') &&
                !!customElements.get('ssr-mixed-client') &&
                !!customElements.get('ssr-mixed-leaf'),
        );

        const outer = page.locator('ssr-mixed-app .outer .on');
        const mid = page.locator('ssr-mixed-app ssr-mixed-client .mid .mn');
        const leaf = page.locator(
            'ssr-mixed-app ssr-mixed-client ssr-mixed-leaf .leaf .ln',
        );

        await expect(outer).toHaveText('0');
        await expect(mid).toHaveText('0');
        await expect(leaf).toHaveText('0');

        await page.locator('ssr-mixed-app .outer > .ob').click();
        await expect(outer).toHaveText('1');
        await expect(mid).toHaveText('0');
        await expect(leaf).toHaveText('0');

        await page.locator('ssr-mixed-client .mid > .mb').click();
        await expect(mid).toHaveText('1');
        await expect(outer).toHaveText('1');
        await expect(leaf).toHaveText('0');

        await page.locator('ssr-mixed-leaf .leaf > .lb').click();
        await expect(leaf).toHaveText('1');
        await expect(mid).toHaveText('1');
        await expect(outer).toHaveText('1');
    });
});
