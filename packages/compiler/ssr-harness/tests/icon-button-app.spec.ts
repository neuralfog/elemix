import { expect, test } from '@playwright/test';

test.describe('IconButtonApp', () => {
    test('an empty dynamic text run before a slot hydrates without crashing', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));

        const response = await page.goto('/icon-button-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<icon-button');
        expect(served).toContain('★');

        await page.waitForFunction(
            () =>
                !!customElements.get('icon-button-app') &&
                !!customElements.get('icon-button'),
        );

        const button = page.locator('icon-button-app icon-button button');
        const pip = page.locator('icon-button-app icon-button .pip');

        await expect(pip).toHaveText('★');
        await expect(button).not.toContainText('Saved');

        await page.locator('icon-button-app button.set').click();
        await expect(button).toContainText('Saved');
        await expect(pip).toHaveText('★');

        await page.locator('icon-button-app button.clear').click();
        await expect(button).not.toContainText('Saved');
        await expect(pip).toHaveText('★');

        expect(errors).toEqual([]);
    });
});
