import { expect, test } from '@playwright/test';

test.describe('DynamicChildApp', () => {
    test('templates reached through a function SSR as raw markup and mount/swap on hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/dynamic-child-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('icon-a');
        expect(served).toContain('icon-b');
        expect(served).toContain('>plain<');
        expect(served).not.toContain('[object');

        await page.waitForFunction(
            () => !!customElements.get('dynamic-child-app'),
        );

        const root = page.locator('dynamic-child-app');
        await expect(root.locator('.row[data-id="a"] .icon-a')).toHaveCount(1);
        await expect(root.locator('.row[data-id="b"] .icon-b')).toHaveCount(1);

        const swap = root.locator('.swap');
        await expect(swap).toHaveText('plain');
        await expect(swap.locator('.badge')).toHaveCount(0);

        await root.locator('.toggle').click();
        await expect(swap.locator('.badge')).toHaveText('NEW');

        await root.locator('.toggle').click();
        await expect(swap.locator('.badge')).toHaveCount(0);
        await expect(swap).toHaveText('plain');
    });
});
