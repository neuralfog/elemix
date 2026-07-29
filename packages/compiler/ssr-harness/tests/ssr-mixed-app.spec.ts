import { expect, test } from '@playwright/test';

test.describe('SsrMixedApp', () => {
    test('mixed tree: SSR outer hydrates, #client middle + its SSR leaf mount fresh; all reactive independently', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-mixed-app');
        const served = (await response?.text()) ?? '';
        // outer is server-rendered (hydratable DSD content)
        expect(served).toContain('<span class="on">0</span>');
        // the #client boundary is a BARE tag - nothing under it rendered server-side
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

        // after upgrade: outer hydrated from server DOM; middle + leaf mounted fresh
        await expect(outer).toHaveText('0');
        await expect(mid).toHaveText('0');
        await expect(leaf).toHaveText('0');

        // each level is independently reactive across the SSR/client boundary
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
