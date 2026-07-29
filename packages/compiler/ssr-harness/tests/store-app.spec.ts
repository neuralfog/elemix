import { expect, test } from '@playwright/test';

test.describe('StoreApp', () => {
    test('a shared reactive object passed as :prop stays live across hydration; child mutates, parent follows', async ({
        page,
    }) => {
        const response = await page.goto('/store-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('store-app');
        expect(served).toContain('store-controls');
        expect(served).toContain('Child controls');

        await page.waitForFunction(
            () =>
                !!customElements.get('store-app') &&
                !!customElements.get('store-controls'),
        );

        const readout = page.locator('store-app .readout strong');
        const childValue = page.locator('store-app store-controls .value');
        const dec = page.locator('store-app store-controls button').nth(0);
        const inc = page.locator('store-app store-controls button').nth(1);

        await expect(readout).toHaveText('0');
        await expect(childValue).toHaveText('0');

        await inc.click();
        await expect(childValue).toHaveText('1');
        await expect(readout).toHaveText('1');

        await inc.click();
        await inc.click();
        await expect(childValue).toHaveText('3');
        await expect(readout).toHaveText('3');

        await dec.click();
        await expect(childValue).toHaveText('2');
        await expect(readout).toHaveText('2');

        await dec.click();
        await dec.click();
        await dec.click();
        await expect(childValue).toHaveText('-1');
        await expect(readout).toHaveText('-1');
    });
});
