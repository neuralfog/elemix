import { expect, test } from '@playwright/test';

test.describe('ParamHelper', () => {
    test('parameterized helper this.row(r) inlined inside a keyed repeat; SSR + reactive', async ({
        page,
    }) => {
        const response = await page.goto('/param-helper');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('row-list');
        expect(served).toContain('data-id="1"');
        expect(served).toContain('>alpha</li>');
        expect(served).toContain('data-id="2"');
        expect(served).toContain('>beta</li>');

        await page.waitForFunction(() => !!customElements.get('row-list'));

        const rows = page.locator('row-list .row');
        const addBtn = page.locator('row-list .add');

        await expect(rows).toHaveText(['alpha', 'beta']);
        await expect(rows.nth(0)).toHaveAttribute('data-id', '1');
        await expect(rows.nth(1)).toHaveAttribute('data-id', '2');

        await addBtn.click();
        await expect(rows).toHaveText(['alpha', 'beta', 'new']);
        await expect(rows.nth(2)).toHaveAttribute('data-id', '3');

        await addBtn.click();
        await expect(rows).toHaveText(['alpha', 'beta', 'new', 'new']);
        await expect(rows.nth(3)).toHaveAttribute('data-id', '4');
    });
});
