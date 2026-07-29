import { expect, test } from '@playwright/test';

test.describe('MethodApp', () => {
    test('method-form template() hydrates: prelude const in one hole, reactive state in another', async ({
        page,
    }) => {
        const response = await page.goto('/method-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('method-app');
        expect(served).toContain('>count</span>');
        expect(served).toContain('>0</span>');

        await page.waitForFunction(() => !!customElements.get('method-app'));

        const lbl = page.locator('method-app .lbl');
        const count = page.locator('method-app .count');
        const inc = page.locator('method-app .inc');

        await expect(lbl).toHaveText('count');
        await expect(count).toHaveText('0');

        await inc.click();
        await expect(count).toHaveText('1');
        await inc.click();
        await expect(count).toHaveText('2');
        await expect(lbl).toHaveText('count');
    });
});
