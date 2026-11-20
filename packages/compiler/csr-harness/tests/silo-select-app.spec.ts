import { expect, test } from '@playwright/test';

test('silo-select-app: one shared selected silo drives the danger class across a keyed list', async ({
    page,
}) => {
    await page.goto('/view/silo-select-app');
    await page.waitForFunction(() => !!customElements.get('silo-select-app'));

    const sel = page.locator('silo-select-app .sel');
    const rows = page.locator('silo-select-app ul.rows li.row');
    const danger = page.locator('silo-select-app ul.rows li.danger');
    const labels = page.locator('silo-select-app ul.rows li.row .rlabel');

    await expect(sel).toHaveText('-1');
    await expect(rows).toHaveCount(3);
    await expect(danger).toHaveCount(0);

    await rows.nth(1).click();
    await expect(sel).toHaveText('2');
    await expect(danger).toHaveCount(1);
    await expect(danger.locator('.rid')).toHaveText('2');

    await rows.nth(2).click();
    await expect(sel).toHaveText('3');
    await expect(danger).toHaveCount(1);
    await expect(danger.locator('.rid')).toHaveText('3');

    await page.locator('silo-select-app .bump').click();
    await expect(labels.nth(0)).toHaveText('alpha!');
    await expect(sel).toHaveText('3');
    await expect(danger.locator('.rid')).toHaveText('3');

    await page.locator('silo-select-app .append').click();
    await expect(rows).toHaveCount(4);
    await expect(sel).toHaveText('3');
    await expect(danger).toHaveCount(1);
    await expect(danger.locator('.rid')).toHaveText('3');

    await page.locator('silo-select-app .clear').click();
    await expect(sel).toHaveText('-1');
    await expect(danger).toHaveCount(0);
});
