import { expect, test } from '@playwright/test';

test.describe('CustomEventApp', () => {
    test('@click + @ping custom event hydrate via addEventListener and stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/custom-event-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="caught"');

        await page.waitForFunction(
            () => !!customElements.get('custom-event-app'),
        );

        const fire = page.locator('custom-event-app .fire');
        const caught = page.locator('custom-event-app .caught');

        await expect(caught).toHaveText('0');

        await fire.click();
        await expect(caught).toHaveText('1');
        await fire.click();
        await expect(caught).toHaveText('2');
        await fire.click();
        await expect(caught).toHaveText('3');
    });
});
