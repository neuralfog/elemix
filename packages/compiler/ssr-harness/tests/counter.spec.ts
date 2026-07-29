import { expect, test } from '@playwright/test';

test.describe('CounterApp', () => {
    test('server-rendered count is reactive after hydration', async ({
        page,
    }) => {
        await page.goto('/counter-app');
        await page.waitForFunction(() => !!customElements.get('counter-app'));

        const button = page.locator('counter-app button');

        await expect(button).toHaveText('count is 0');

        await button.click();
        await expect(button).toHaveText('count is 1');
        await button.click();
        await expect(button).toHaveText('count is 2');
        await button.click();
        await expect(button).toHaveText('count is 3');
        await button.click();
        await expect(button).toHaveText('count is 4');
    });
});
