import { expect, test } from '@playwright/test';

test.describe('AsyncApp', () => {
    test('async before-mount/mount/effect lifecycle resolves after hydration', async ({
        page,
    }) => {
        const response = await page.goto('/async-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('async-app');
        expect(served).toContain('class="phase"');

        await page.waitForFunction(() => !!customElements.get('async-app'));

        const app = page.locator('async-app');
        await expect(app).toHaveAttribute('data-prepared', 'async');
        await expect(page.locator('async-app .phase')).toHaveText('ready');
        await expect(app).toHaveAttribute('data-phase', 'ready');

        await page.locator('async-app .bump').click();
        await expect(page.locator('async-app .ticks')).toHaveText('1');
    });
});
