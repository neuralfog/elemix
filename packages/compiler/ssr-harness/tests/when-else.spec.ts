import { expect, test } from '@playwright/test';

test.describe('WhenElseApp', () => {
    test('when/otherwise branches swap reactively after hydration', async ({
        page,
    }) => {
        await page.goto('/when-else-app');
        await page.waitForFunction(() => !!customElements.get('when-else-app'));

        const idle = page.locator('when-else-app .card.idle');
        const ready = page.locator('when-else-app .card.ready');
        const toggle = page.locator('when-else-app .toggle');

        await expect(idle).toHaveText('Please log in');
        await expect(ready).toHaveCount(0);

        await toggle.click();
        await expect(ready).toHaveText('✓ Welcome back');
        await expect(idle).toHaveCount(0);

        await toggle.click();
        await expect(idle).toHaveText('Please log in');
        await expect(ready).toHaveCount(0);
    });
});
