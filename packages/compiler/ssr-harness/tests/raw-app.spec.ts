import { expect, test } from '@playwright/test';

test.describe('RawApp', () => {
    test('raw() class instance (private #field) is non-reactive; manual render() re-reads; reactive state coexists', async ({
        page,
    }) => {
        const response = await page.goto('/raw-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('raw-app');
        expect(served).toContain('>0</span>');

        await page.waitForFunction(() => !!customElements.get('raw-app'));

        const ticks = page.locator('raw-app .ticks');
        const count = page.locator('raw-app .count');
        const labels = page.locator('raw-app ul.rows li.row .rlabel');
        const ids = page.locator('raw-app ul.rows li.row .rid');
        const tickBtn = page.locator('raw-app .tick');
        const refreshBtn = page.locator('raw-app .refresh');
        const incBtn = page.locator('raw-app .inc');
        const addRowBtn = page.locator('raw-app .add-row');

        await expect(ticks).toHaveText('0');
        await expect(count).toHaveText('0');
        await expect(labels).toHaveText(['A']);

        await tickBtn.click();
        await tickBtn.click();
        await tickBtn.click();
        await expect(ticks).toHaveText('0');

        await refreshBtn.click();
        await expect(ticks).toHaveText('3');

        await incBtn.click();
        await expect(count).toHaveText('1');

        await tickBtn.click();
        await incBtn.click();
        await expect(count).toHaveText('2');
        await expect(ticks).toHaveText('3');

        await refreshBtn.click();
        await expect(ticks).toHaveText('4');

        await addRowBtn.click();
        await expect(labels).toHaveText(['A', 'B']);
        await expect(ids).toHaveText(['a', 'b']);
    });
});
