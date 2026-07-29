import { expect, test } from '@playwright/test';

test.describe('ClassStateApp', () => {
    test('class instances in state: getters, nested methods, array mutation', async ({
        page,
    }) => {
        const response = await page.goto('/class-state-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('apple');
        expect(served).toContain('banana');

        await page.waitForFunction(
            () => !!customElements.get('class-state-app'),
        );

        const read = (sel: string) => page.locator(`class-state-app ${sel}`);
        const col = (cls: string) =>
            page.locator(`class-state-app ul.items li.item .${cls}`);
        const click = (sel: string) =>
            page.locator(`class-state-app ${sel}`).click();

        await expect(read('.count')).toHaveText('2');
        await expect(read('.subtotal')).toHaveText('7');
        await expect(read('.coupon')).toHaveText('0');
        await expect(read('.total')).toHaveText('7');
        await expect(col('name')).toHaveText(['apple', 'banana']);
        await expect(col('qty')).toHaveText(['2', '3']);
        await expect(col('line')).toHaveText(['4', '3']);

        await click('.bump');
        await expect(col('qty')).toHaveText(['3', '3']);
        await expect(col('line')).toHaveText(['6', '3']);
        await expect(read('.subtotal')).toHaveText('9');
        await expect(read('.total')).toHaveText('9');

        await click('.add');
        await expect(read('.count')).toHaveText('3');
        await expect(read('.subtotal')).toHaveText('14');
        await expect(col('name')).toHaveText(['apple', 'banana', 'cherry']);
        await expect(col('line')).toHaveText(['6', '3', '5']);

        await click('.coupon-btn');
        await expect(read('.coupon')).toHaveText('3');
        await expect(read('.total')).toHaveText('11');

        await click('.remove');
        await expect(read('.count')).toHaveText('2');
        await expect(read('.subtotal')).toHaveText('11');
        await expect(read('.total')).toHaveText('8');
        await expect(col('name')).toHaveText(['apple', 'cherry']);

        await click('.clear');
        await expect(read('.count')).toHaveText('0');
        await expect(read('.subtotal')).toHaveText('0');
        await expect(read('.coupon')).toHaveText('0');
        await expect(read('.total')).toHaveText('0');
        await expect(col('name')).toHaveText([]);
    });
});
