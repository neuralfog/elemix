import { expect, test } from '@playwright/test';

test('derived-app: computed subtotal/total track qty and price', async ({
    page,
}) => {
    await page.goto('/view/derived-app');

    await expect(page.locator('.subtotal')).toHaveText('20');
    await expect(page.locator('.total')).toHaveText('24');

    await page.locator('.add-qty').click();
    await expect(page.locator('.qty')).toHaveText('3');
    await expect(page.locator('.subtotal')).toHaveText('30');
    await expect(page.locator('.total')).toHaveText('36');

    await page.locator('.bump-price').click();
    await expect(page.locator('.price')).toHaveText('15');
    await expect(page.locator('.subtotal')).toHaveText('45');
    await expect(page.locator('.total')).toHaveText('54');
});
