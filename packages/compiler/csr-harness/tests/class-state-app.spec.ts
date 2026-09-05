import { expect, test } from '@playwright/test';

test('class-state-app: class-instance state drives cart totals', async ({
    page,
}) => {
    await page.goto('/view/class-state-app');
    const col = (cls: string) => page.locator(`ul.items li.item .${cls}`);

    await expect(page.locator('.count')).toHaveText('2');
    await expect(page.locator('.subtotal')).toHaveText('7');
    await expect(page.locator('.coupon')).toHaveText('0');
    await expect(page.locator('.total')).toHaveText('7');
    await expect(col('name')).toHaveText(['apple', 'banana']);
    await expect(col('qty')).toHaveText(['2', '3']);
    await expect(col('line')).toHaveText(['4', '3']);

    await page.locator('.bump').click();
    await expect(col('qty')).toHaveText(['3', '3']);
    await expect(col('line')).toHaveText(['6', '3']);
    await expect(page.locator('.subtotal')).toHaveText('9');
    await expect(page.locator('.total')).toHaveText('9');
    await expect(page.locator('.count')).toHaveText('2');

    await page.locator('.add').click();
    await expect(page.locator('.count')).toHaveText('3');
    await expect(page.locator('.subtotal')).toHaveText('14');
    await expect(page.locator('.total')).toHaveText('14');
    await expect(col('name')).toHaveText(['apple', 'banana', 'cherry']);
    await expect(col('qty')).toHaveText(['3', '3', '1']);
    await expect(col('line')).toHaveText(['6', '3', '5']);

    await page.locator('.coupon-btn').click();
    await expect(page.locator('.coupon')).toHaveText('3');
    await expect(page.locator('.subtotal')).toHaveText('14');
    await expect(page.locator('.total')).toHaveText('11');

    await page.locator('.remove').click();
    await expect(page.locator('.count')).toHaveText('2');
    await expect(page.locator('.subtotal')).toHaveText('11');
    await expect(page.locator('.total')).toHaveText('8');
    await expect(col('name')).toHaveText(['apple', 'cherry']);
    await expect(col('qty')).toHaveText(['3', '1']);
    await expect(col('line')).toHaveText(['6', '5']);

    await page.locator('.clear').click();
    await expect(page.locator('.count')).toHaveText('0');
    await expect(page.locator('.subtotal')).toHaveText('0');
    await expect(page.locator('.coupon')).toHaveText('0');
    await expect(page.locator('.total')).toHaveText('0');
    await expect(col('name')).toHaveCount(0);
});
