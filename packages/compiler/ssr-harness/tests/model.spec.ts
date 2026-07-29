import { expect, test } from '@playwright/test';

test.describe('ModelApp', () => {
    test('~model two-way binding and ~onmodel clamp hydrate and stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/model-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Hello, Ada');
        expect(served).toContain('Volume: 50');
        expect(served).toContain('value="Ada"');
        expect(served).toContain('value="50"');

        await page.waitForFunction(() => !!customElements.get('model-app'));

        const nameInput = page.locator('model-app input').nth(0);
        const volumeInput = page.locator('model-app input').nth(1);
        const nameOut = page.locator('model-app .out').nth(0);
        const volumeOut = page.locator('model-app .out').nth(1);

        await expect(nameInput).toHaveValue('Ada');
        await expect(nameOut).toHaveText('Hello, Ada');
        await expect(volumeInput).toHaveValue('50');
        await expect(volumeOut).toHaveText('Volume: 50');

        await nameInput.click();
        await nameInput.press('End');
        await nameInput.pressSequentially(' Lovelace');
        await expect(nameInput).toHaveValue('Ada Lovelace');
        await expect(nameOut).toHaveText('Hello, Ada Lovelace');

        await volumeInput.click();
        await volumeInput.press('End');
        await volumeInput.pressSequentially('9');
        await expect(volumeInput).toHaveValue('100');
        await expect(volumeOut).toHaveText('Volume: 100');
    });
});
