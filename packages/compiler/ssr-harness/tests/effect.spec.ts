import { expect, test } from '@playwright/test';

test.describe('EffectApp', () => {
    test('#effect hooks run on hydrate (isMounted-guarded one skips) then react', async ({
        page,
    }) => {
        const response = await page.goto('/effect-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="count"');
        expect(served).not.toContain('data-count=');

        await page.waitForFunction(() => !!customElements.get('effect-app'));

        const host = page.locator('effect-app');
        const count = page.locator('effect-app .count');
        const inc = page.locator('effect-app .inc');

        await expect(count).toHaveText('0');
        await expect(host).toHaveAttribute('data-count', '0');
        await expect(host).not.toHaveAttribute('data-changed', /.*/);

        await inc.click();
        await expect(count).toHaveText('1');
        await expect(host).toHaveAttribute('data-count', '1');
        await expect(host).toHaveAttribute('data-changed', '1');

        await inc.click();
        await expect(count).toHaveText('2');
        await expect(host).toHaveAttribute('data-count', '2');
        await expect(host).toHaveAttribute('data-changed', '2');
    });
});
