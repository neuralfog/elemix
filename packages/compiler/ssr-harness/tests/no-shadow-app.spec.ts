import { expect, test } from '@playwright/test';

test.describe('NoShadowApp', () => {
    test('#no-shadow SSRs into the light DOM (no DSD) and hydrates in place without duplicating', async ({
        page,
    }) => {
        const response = await page.goto('/no-shadow-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('no-shadow-app');
        expect(served).toContain('<div class="light">');
        expect(served).not.toContain('shadowrootmode');
        expect(served).not.toContain('data-ssr');
        expect(served).toContain('>0</span>');

        await page.waitForFunction(() => !!customElements.get('no-shadow-app'));

        const host = page.locator('no-shadow-app');
        const light = page.locator('no-shadow-app .light');
        const count = page.locator('no-shadow-app .count');
        const inc = page.locator('no-shadow-app .inc');

        const hasShadow = await host.evaluate(
            (el) => !!(el as Element & { shadowRoot: unknown }).shadowRoot,
        );
        expect(hasShadow).toBe(false);

        await expect(light).toHaveCount(1);
        await expect(count).toHaveCount(1);
        await expect(count).toHaveText('0');

        await inc.click();
        await expect(count).toHaveText('1');
        await expect(light).toHaveCount(1);
        await inc.click();
        await expect(count).toHaveText('2');
    });
});
