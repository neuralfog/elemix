import { expect, test } from '@playwright/test';

test.describe('SiloSelectApp', () => {
    test('shared selected silo renders unselected server-side, then drives danger on hydration', async ({
        page,
    }) => {
        const response = await page.goto('/silo-select-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('silo-select-app');
        expect(served).toContain('>-1</span>');
        expect(served).toContain('alpha');
        expect(served).not.toContain('row danger');

        await page.waitForFunction(
            () => !!customElements.get('silo-select-app'),
        );

        const sel = page.locator('silo-select-app .sel');
        const rows = page.locator('silo-select-app ul.rows li.row');
        const danger = page.locator('silo-select-app ul.rows li.danger');

        await expect(sel).toHaveText('-1');
        await expect(rows).toHaveCount(3);
        await expect(danger).toHaveCount(0);

        await rows.nth(1).click();
        await expect(sel).toHaveText('2');
        await expect(danger).toHaveCount(1);
        await expect(danger.locator('.rid')).toHaveText('2');

        await rows.nth(0).click();
        await expect(sel).toHaveText('1');
        await expect(danger).toHaveCount(1);
        await expect(danger.locator('.rid')).toHaveText('1');

        await page.locator('silo-select-app .clear').click();
        await expect(sel).toHaveText('-1');
        await expect(danger).toHaveCount(0);
    });
});
