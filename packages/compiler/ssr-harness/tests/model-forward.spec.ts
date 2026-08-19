import { expect, test } from '@playwright/test';

test.describe('ModelForwardApp', () => {
    test('a ref forwarded through a child prop stays two-way reactive', async ({
        page,
    }) => {
        const response = await page.goto('/model-forward-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Hello, Ada');
        expect(served).toContain('value="Ada"');

        await page.waitForFunction(
            () => !!customElements.get('model-forward-app'),
        );

        const input = page.locator('model-forward-app input').first();
        const out = page.locator('model-forward-app .out').first();

        await expect(input).toHaveValue('Ada');
        await expect(out).toHaveText('Hello, Ada');

        await input.focus();
        await input.press('End');
        await input.pressSequentially(' Lovelace');

        await expect(input).toHaveValue('Ada Lovelace');
        await expect(out).toHaveText('Hello, Ada Lovelace');
    });
});
