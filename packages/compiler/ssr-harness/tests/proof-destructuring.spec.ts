import { expect, test } from '@playwright/test';

test.describe('ProofDestructuring', () => {
    test('template-body prelude `const { inc, dec } = this` survives into hydration handlers', async ({
        page,
    }) => {
        const response = await page.goto('/proof-destructuring');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('proof-destructuring');
        expect(served).toContain('>0</span>');

        await page.waitForFunction(
            () => !!customElements.get('proof-destructuring'),
        );

        const count = page.locator('proof-destructuring .count');
        const inc = page.locator('proof-destructuring .inc');
        const dec = page.locator('proof-destructuring .dec');

        await expect(count).toHaveText('0');

        await inc.click();
        await inc.click();
        await expect(count).toHaveText('2');

        await dec.click();
        await expect(count).toHaveText('1');
    });
});
