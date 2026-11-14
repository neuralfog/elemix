import { expect, test } from '@playwright/test';

test.describe('empty trailing text hole (hydration splitRun)', () => {
    test('empty last-child interpolation hydrates without crashing and stays reactive', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        const response = await page.goto('/empty-trailing-hole-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Hello </p>');

        await page.waitForFunction(
            () => !!customElements.get('empty-trailing-hole-app'),
        );
        const greet = page.locator('empty-trailing-hole-app .greet');
        await expect(greet).toHaveText('Hello');

        await page.locator('empty-trailing-hole-app button').click();
        await expect(greet).toHaveText('Hello World');

        expect(errors).toEqual([]);
    });
});
