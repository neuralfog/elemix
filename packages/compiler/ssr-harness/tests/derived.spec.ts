import { expect, test } from '@playwright/test';

test.describe('DerivedApp', () => {
    test('getter-derived values (chained) SSR and recompute reactively', async ({
        page,
    }) => {
        const response = await page.goto('/derived-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('20');
        expect(served).toContain('24');

        await page.waitForFunction(() => !!customElements.get('derived-app'));

        const qty = page.locator('derived-app .num.qty');
        const price = page.locator('derived-app .num.price');
        const subtotal = page.locator('derived-app .num.subtotal');
        const total = page.locator('derived-app .num.total');

        await expect(qty).toHaveText('2');
        await expect(price).toHaveText('10');
        await expect(subtotal).toHaveText('20');
        await expect(total).toHaveText('24');

        await page.locator('derived-app .add-qty').click();
        await expect(qty).toHaveText('3');
        await expect(subtotal).toHaveText('30');
        await expect(total).toHaveText('36');

        await page.locator('derived-app .bump-price').click();
        await expect(price).toHaveText('15');
        await expect(subtotal).toHaveText('45');
        await expect(total).toHaveText('54');
    });
});
